import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        driver: {
          select: {
            id:         true,
            name:       true,
            phone:      true,
            avatar_url: true,
            driver_profile: {
              select: {
                vehicle_type:   true,
                vehicle_number: true,
                vehicle_model:  true,
                avg_rating:     true,
                total_trips:    true,
              },
            },
          },
        },
        bookings: { select: { id: true, status: true, seats: true } },
      },
    });

    if (!ride) {
      return Response.json(
        { data: null, error: "Ride not found" },
        { status: 404 }
      );
    }

    return Response.json({ data: ride, error: null });
  } catch (err) {
    console.error("[rides/[id] GET]", err);
    return Response.json(
      { data: null, error: "Failed to fetch ride" },
      { status: 500 }
    );
  }
}
