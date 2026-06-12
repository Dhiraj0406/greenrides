import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dispatches = await prisma.driverDispatch.findMany({
      where: { status: "PENDING" },
      include: {
        request: { select: { from_city: true, to_city: true, fare_paise: true, travel_date: true, status: true } },
        driver:  { select: { name: true, phone: true } },
      },
      orderBy: { dispatched_at: "asc" },
    });
    return Response.json({ data: dispatches, error: null });
  } catch (err) {
    console.error("[admin/dispatch GET]", err);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

const postSchema = z.object({
  request_id:    z.string().uuid(),
  driver_user_id: z.string().uuid(),
});

/** POST /api/admin/dispatch
 *  Create a DriverDispatch record for a pending RideRequest.
 *  driver_user_id must be the User.id (not DriverProfile.id).
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { request_id, driver_user_id } = parsed.data;

  try {
    // Verify the request exists and is dispatchable
    const request = await prisma.rideRequest.findUnique({
      where: { id: request_id },
      select: { id: true, status: true },
    });
    if (!request) return Response.json({ error: "RideRequest not found" }, { status: 404 });
    if (!["PENDING", "IN_PROGRESS"].includes(request.status)) {
      return Response.json({ error: `RideRequest is ${request.status}, cannot dispatch` }, { status: 400 });
    }

    // Verify driver exists
    const driver = await prisma.user.findUnique({
      where: { id: driver_user_id },
      select: { id: true },
    });
    if (!driver) return Response.json({ error: "Driver not found" }, { status: 404 });

    // Determine next order_index for this request
    const maxOrder = await prisma.driverDispatch.aggregate({
      where:  { request_id },
      _max:   { order_index: true },
    });
    const order_index = (maxOrder._max.order_index ?? -1) + 1;

    const expires_at = new Date(Date.now() + 5 * 60_000); // 5 minutes

    const dispatch = await prisma.driverDispatch.create({
      data: {
        request_id,
        driver_id:    driver_user_id,
        order_index,
        status:       "WAITING",
        expires_at,
      },
    });

    // Mark the request as dispatched
    await prisma.rideRequest.update({
      where: { id: request_id },
      data:  { dispatched: true },
    });

    return Response.json({ data: dispatch, error: null });
  } catch (err) {
    console.error("[admin/dispatch POST]", err);
    return Response.json({ error: "Failed to create dispatch" }, { status: 500 });
  }
}
