import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const [pendingDrivers, pendingOwners] = await Promise.all([
      prisma.driverProfile.findMany({
        where:   { is_approved: false },
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { created_at: "desc" },
      }),
      prisma.owner.findMany({
        where:   { status: "PENDING" },
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { created_at: "desc" },
      }),
    ]);

    return Response.json({ data: { drivers: pendingDrivers, owners: pendingOwners }, error: null });
  } catch (err) {
    console.error("[admin/applicants GET]", err);
    return Response.json({ data: null, error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { user_id, action, applicant_type } = body as {
    user_id?: string; action?: string; applicant_type?: string;
  };

  if (!user_id || !action || !applicant_type) {
    return Response.json({ data: null, error: "user_id, action, applicant_type required" }, { status: 400 });
  }
  if (!["approve", "reject"].includes(action)) {
    return Response.json({ data: null, error: "action must be approve or reject" }, { status: 400 });
  }
  if (!["driver", "owner", "both"].includes(applicant_type)) {
    return Response.json({ data: null, error: "Invalid applicant_type" }, { status: 400 });
  }

  const adminClient = getAdminClient();

  try {
    if (action === "approve") {
      const isDriver = applicant_type === "driver" || applicant_type === "both";
      const isOwner  = applicant_type === "owner"  || applicant_type === "both";
      const roles: string[] = [];

      if (isDriver) {
        await prisma.driverProfile.update({
          where: { user_id },
          data:  { is_approved: true, approved_at: new Date() },
        });
        await prisma.user.update({ where: { id: user_id }, data: { role: "DRIVER" } });
        roles.push("driver");
      }

      if (isOwner) {
        await prisma.owner.update({ where: { user_id }, data: { status: "ACTIVE" } });
        if (!roles.includes("driver")) {
          await prisma.user.update({ where: { id: user_id }, data: { role: "OWNER" } });
        }
        roles.push("owner");
      }

      await adminClient.auth.admin.updateUserById(user_id, {
        app_metadata: { roles, fleet_status: "active" },
      });

      const user = await prisma.user.findUnique({ where: { id: user_id }, select: { name: true } });
      await prisma.notification.create({
        data: {
          user_id,
          type:  "application_approved",
          title: "Application Approved!",
          body:  `Welcome to Green Rides fleet, ${user?.name ?? ""}. You can now log in.`,
        },
      });
    } else {
      await adminClient.auth.admin.updateUserById(user_id, {
        app_metadata: { fleet_status: "rejected" },
      });
    }

    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error("[admin/applicants PATCH]", err);
    return Response.json({ data: null, error: "Action failed" }, { status: 500 });
  }
}
