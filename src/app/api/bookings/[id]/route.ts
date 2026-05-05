import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        ride:  { include: { driver: { select: { name: true, phone: true } } } },
        rider: { select: { name: true, phone: true } },
        payment: true,
      },
    });

    if (!booking) {
      return Response.json(
        { data: null, error: "Booking not found" },
        { status: 404 }
      );
    }

    return Response.json({ data: booking, error: null });
  } catch (err) {
    console.error("[bookings/[id] GET]", err);
    return Response.json(
      { data: null, error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}
