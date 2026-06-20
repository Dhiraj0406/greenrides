import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body   = await req.json().catch(() => ({}));
  const { action } = body as { action?: string };

  if (action !== "approve" && action !== "decline") {
    return Response.json({ data: null, error: "action must be approve or decline" }, { status: 400 });
  }

  const db = getAdminClient();

  // Fetch the request
  const { data: ownerReq, error: fetchErr } = await db
    .from("OwnerRequest")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (fetchErr || !ownerReq) {
    return Response.json({ data: null, error: "Request not found" }, { status: 404 });
  }
  if (ownerReq.status !== "PENDING") {
    return Response.json({ data: null, error: "Request is no longer pending" }, { status: 409 });
  }

  const newStatus = action === "approve" ? "APPROVED" : "DECLINED";

  // Update request status
  const { error: updateErr } = await db
    .from("OwnerRequest")
    .update({ status: newStatus, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    console.error("[admin/owner-requests PATCH update]", updateErr);
    return Response.json({ data: null, error: "Failed to update request" }, { status: 500 });
  }

  if (action === "approve") {
    // Fetch user details for Owner row
    const { data: userData } = await db
      .from("User")
      .select("id, name, phone, email")
      .eq("id", ownerReq.user_id)
      .single();

    // Create Owner row (upsert in case one already exists)
    await db.from("Owner").upsert({
      user_id: ownerReq.user_id,
      name:    userData?.name  ?? "",
      phone:   userData?.phone ?? "",
      email:   userData?.email ?? null,
      status:  "ACTIVE",
    }, { onConflict: "user_id" });

    // Add owner role to app_metadata
    const { data: authData, error: authFetchErr } = await db.auth.admin.getUserById(ownerReq.user_id);
    if (authFetchErr || !authData?.user) {
      console.error("[admin/owner-requests PATCH getUserById]", authFetchErr);
      return Response.json({ data: null, error: "Failed to update user roles" }, { status: 500 });
    }
    const existingRoles: string[] = (authData.user.app_metadata?.roles as string[]) ?? [];
    if (!existingRoles.includes("owner")) {
      const { error: roleErr } = await db.auth.admin.updateUserById(ownerReq.user_id, {
        app_metadata: { roles: [...existingRoles, "owner"] },
      });
      if (roleErr) {
        console.error("[admin/owner-requests PATCH updateUserById]", roleErr);
        return Response.json({ data: null, error: "Failed to update user roles" }, { status: 500 });
      }
    }
  }

  return Response.json({ data: { status: newStatus }, error: null });
}
