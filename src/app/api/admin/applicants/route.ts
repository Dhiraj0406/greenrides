import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const [{ data: drivers }, { data: owners }] = await Promise.all([
      db.from("DriverProfile")
        .select("*, user:user_id(id, name, phone)")
        .eq("is_approved", false)
        .order("created_at", { ascending: false }),
      db.from("Owner")
        .select("*, user:user_id(id, name, phone)")
        .eq("status", "PENDING")
        .order("created_at", { ascending: false }),
    ]);

    return Response.json({ data: { drivers: drivers ?? [], owners: owners ?? [] }, error: null });
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

  const db = getAdminClient();

  try {
    if (action === "approve") {
      const isDriver = applicant_type === "driver" || applicant_type === "both";
      const isOwner  = applicant_type === "owner"  || applicant_type === "both";
      const roles: string[] = [];

      if (isDriver) {
        await db.from("DriverProfile")
          .update({ is_approved: true, approved_at: new Date().toISOString() })
          .eq("user_id", user_id);
        await db.from("User").update({ role: "DRIVER" }).eq("id", user_id);
        roles.push("driver");
      }

      if (isOwner) {
        await db.from("Owner").update({ status: "ACTIVE" }).eq("user_id", user_id);
        if (!roles.includes("driver")) {
          await db.from("User").update({ role: "OWNER" }).eq("id", user_id);
        }
        roles.push("owner");
      }

      const { data: existingAuth } = await db.auth.admin.getUserById(user_id);
      const existingMeta  = existingAuth?.user?.app_metadata ?? {};
      const existingRoles = (existingMeta.roles as string[] | undefined) ?? [];
      const mergedRoles   = [...new Set([...existingRoles, ...roles])];

      await db.auth.admin.updateUserById(user_id, {
        app_metadata: { ...existingMeta, roles: mergedRoles, fleet_status: "active" },
      });

      const { data: user } = await db.from("User").select("name").eq("id", user_id).single();
      await db.from("Notification").insert({
        user_id,
        type:  "application_approved",
        title: "Application Approved!",
        body:  `Welcome to Green Rides fleet, ${user?.name ?? ""}. You can now log in.`,
      });
    } else {
      await db.auth.admin.updateUserById(user_id, {
        app_metadata: { fleet_status: "rejected" },
      });
    }

    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error("[admin/applicants PATCH]", err);
    return Response.json({ data: null, error: "Action failed" }, { status: 500 });
  }
}
