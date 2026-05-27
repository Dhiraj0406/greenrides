import { NextRequest } from "next/server";
import { z } from "zod";
import { getRouteData } from "@/lib/maps";
import { estimateCustomFare } from "@/lib/claude-ai";

const schema = z.object({
  from: z.string().min(2),
  to:   z.string().min(2),
});

function formulaFare(km: number): number {
  return Math.max(500, Math.round((km * 20) / 25) * 25);
}

function formulaDuration(km: number): { min: number; text: string } {
  const min = Math.round((km / 45) * 60);
  return { min, text: `${Math.floor(min / 60)}h ${min % 60}m` };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: "from and to are required" },
      { status: 400 }
    );
  }

  const { from, to } = parsed.data;

  // Step 1: Try real distance from Google Maps
  let distanceKm: number;
  let durationMin: number;
  let durationText: string;
  let usedFallback = false;

  try {
    const route = await getRouteData(from, to);
    distanceKm  = route.distance_km;
    durationMin = route.duration_min;
    durationText = route.duration_text;
  } catch (err) {
    console.warn("[ai/estimate] Google Maps failed, using formula fallback:", err);
    // Rough straight-line fallback: assume ~150km for an unknown route
    // Claude will refine the fare, but we can't do much without a real distance.
    // We return an error so the client knows to show a degraded result.
    return Response.json(
      { data: null, error: "Could not calculate distance. Check the city names and try again." },
      { status: 422 }
    );
  }

  // Step 2: Try Claude Haiku for fare estimate, fall back to formula
  let fare: number;
  let confidence: "high" | "medium" | "low";
  let notes: string;

  try {
    const estimate = await estimateCustomFare(from, to, distanceKm, durationMin);
    fare       = estimate.fare;
    confidence = estimate.confidence;
    notes      = estimate.notes;
  } catch {
    usedFallback = true;
    fare       = formulaFare(distanceKm);
    confidence = "medium";
    notes      = `${distanceKm} km · formula estimate`;
  }

  if (usedFallback) {
    const fallback = formulaDuration(distanceKm);
    durationMin  = fallback.min;
    durationText = fallback.text;
  }

  return Response.json({
    data: {
      from,
      to,
      distance_km:   distanceKm,
      duration_min:  durationMin,
      duration_text: durationText,
      fare,
      confidence,
      notes,
    },
    error: null,
  });
}
