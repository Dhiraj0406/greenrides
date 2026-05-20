import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

const schema = z.object({
  type:           z.enum(["driver", "owner", "both"]),
  name:           z.string().min(2),
  phone:          z.string().min(10),
  license_number: z.string().optional(),
  vehicle_type:   z.string().optional(),
  vehicle_number: z.string().optional(),
  vehicle_model:  z.string().optional(),
  email:          z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const adminClient = getAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
  const userId = authData.user.id;

  const body   = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const isDriver = d.type === "driver" || d.type === "both";
    const isOwner  = d.type === "owner"  || d.type === "both";

    await prisma.user.update({
      where: { id: userId },
      data:  { name: d.name, phone: d.phone },
    });

    if (isDriver) {
      if (!d.license_number || !d.vehicle_type || !d.vehicle_number || !d.vehicle_model) {
        return Response.json({ data: null, error: "Driver fields required" }, { status: 400 });
      }
      await prisma.driverProfile.upsert({
        where:  { user_id: userId },
        create: {
          user_id:        userId,
          license_number: d.license_number,
          vehicle_type:   d.vehicle_type,
          vehicle_number: d.vehicle_number,
          vehicle_model:  d.vehicle_model,
          is_approved:    false,
        },
        update: {
          license_number: d.license_number,
          vehicle_type:   d.vehicle_type,
          vehicle_number: d.vehicle_number,
          vehicle_model:  d.vehicle_model,
        },
      });
    }

    if (isOwner) {
      await prisma.owner.upsert({
        where:  { user_id: userId },
        create: { user_id: userId, name: d.name, phone: d.phone, email: d.email ?? null },
        update: { name: d.name, phone: d.phone, email: d.email ?? null },
      });
    }

    await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { fleet_status: "pending" },
    });

    return Response.json({ data: { registered: true }, error: null });
  } catch (err) {
    console.error("[fleet/register]", err);
    return Response.json({ data: null, error: "Registration failed" }, { status: 500 });
  }
}
