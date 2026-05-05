import { NextRequest } from "next/server";
import { z } from "zod";
import { getRouteData } from "@/lib/maps";
import { estimateCustomFare } from "@/lib/claude-ai";

const schema = z.object({
  from: z.string().min(2),
  to:   z.string().min(2),
});

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

  try {
    // Step 1: Real distance from Google Maps
    const route = await getRouteData(from, to);

    // Step 2: Claude Haiku fare estimate
    const estimate = await estimateCustomFare(
      from,
      to,
      route.distance_km,
      route.duration_min
    );

    return Response.json({
      data: {
        from,
        to,
        distance_km:   route.distance_km,
        duration_min:  route.duration_min,
        duration_text: route.duration_text,
        fare:          estimate.fare,
        confidence:    estimate.confidence,
        notes:         estimate.notes,
      },
      error: null,
    });
  } catch (err) {
    console.error("[ai/estimate]", err);
    return Response.json(
      { data: null, error: "Could not estimate fare for this route" },
      { status: 500 }
    );
  }
}
