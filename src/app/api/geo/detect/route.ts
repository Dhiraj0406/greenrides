import { NextRequest } from "next/server";
import { z } from "zod";
import { detectCityFromCoords } from "@/lib/maps";

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parsed = schema.safeParse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
  });

  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const city = await detectCityFromCoords(parsed.data.lat, parsed.data.lng);
    return Response.json({ data: { city }, error: null });
  } catch (err) {
    console.error("[geo/detect]", err);
    return Response.json(
      { data: null, error: "Could not detect city" },
      { status: 500 }
    );
  }
}
