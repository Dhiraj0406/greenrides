import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const patchSchema = z.object({
  status:         z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]),
  driver_name:    z.string().max(100).optional(),
  driver_phone:   z.string().max(20).optional(),
  eta_min:        z.number().int().min(1).max(600).optional(),
  cancel_reason:  z.string().max(300).optional(),
});

const VALID_TRANSITIONS: Partial<Record<string, string[]>> = {
  PENDING:     ["CONFIRMED", "CANCELLED"],
  CONFIRMED:   ["CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { status, driver_name, driver_phone, eta_min, cancel_reason } = parsed.data;

  const updateData: Record<string, unknown> = { status };
  if (status === "CONFIRMED") {
    if (driver_name  !== undefined) updateData.driver_name  = driver_name;
    if (driver_phone !== undefined) updateData.driver_phone = driver_phone;
    if (eta_min      !== undefined) updateData.eta_min      = eta_min;
  }
  if (status === "CANCELLED" && cancel_reason !== undefined) {
    updateData.notes = cancel_reason;
  }

  try {
    const db = getAdminClient();

    const { data: current } = await db
      .from("RideRequest")
      .select("status")
      .eq("id", id)
      .single();

    if (!current) {
      return Response.json({ data: null, error: "Booking not found" }, { status: 404 });
    }
    if (!VALID_TRANSITIONS[current.status]?.includes(status)) {
      return Response.json(
        { data: null, error: `Cannot move from ${current.status} to ${status}` },
        { status: 409 }
      );
    }

    const { data, error } = await db
      .from("RideRequest")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/requests/:id PATCH]", err);
    return Response.json({ data: null, error: "Not found or update failed" }, { status: 404 });
  }
}
