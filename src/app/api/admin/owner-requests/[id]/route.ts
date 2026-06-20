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

  // All side effects run BEFORE updating the request status
  // so that a partial failure leaves the request in PENDING and admin can retry
  if (action === "approve") {
    // Step 1: Fetch user details
    const { data: userData, error: userFetchErr } = await db
      .from("User")
      .select("id, name, phone, email")
      .eq("id", ownerReq.user_id)
      .single();

    if (userFetchErr || !userData) {
      console.error("[admin/owner-requests PATCH fetchUser]", userFetchErr);
      return Response.json({ data: null, error: "Failed to fetch user details" }, { status: 500 });
    }

    // Step 2: Upsert Owner row
    const { error: upsertErr } = await db.from("Owner").upsert({
      user_id: ownerReq.user_id,
      name:    userData.name  ?? "",
      phone:   userData.phone ?? "",
      email:   userData.email ?? null,
      status:  "ACTIVE",
    }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("[admin/owner-requests PATCH upsert]", upsertErr);
      return Response.json({ data: null, error: "Failed to create owner record" }, { status: 500 });
    }

    // Step 3: Add owner role to app_metadata
    const { data: authData, error: authFetchErr } = await db.auth.admin.getUserById(ownerReq.user_id);
    if (authFetchErr || !authData?.user) {
      console.error("[admin/owner-requests PATCH getUserById]", authFetchErr);
      return Response.json({ data: null, error: "Failed to update user roles" }, { status: 500 });
    }
    const existingRoles: string[] = (authData.user.app_metadata?.roles as string[]) ?? [];
    if (!existingRoles.includes("owner")) {
      const { error: roleErr } = await db.auth.admin.updateUserById(ownerReq.user_id, {
        app_metadata: { ...authData.user.app_metadata, roles: [...existingRoles, "owner"] },
      });
      if (roleErr) {
        console.error("[admin/owner-requests PATCH updateUserById]", roleErr);
        return Response.json({ data: null, error: "Failed to update user roles" }, { status: 500 });
      }
    }
  }

  // Step 4: Notify the driver (non-blocking — failure here does not prevent approval)
  if (action === "approve") {
    const { data: ownerData } = await db.from("User").select("name").eq("id", ownerReq.user_id).maybeSingle();
    await db.from("Notification").insert({
      user_id: ownerReq.user_id,
      type:    "owner_approved",
      title:   "Owner Access Granted!",
      body:    `Congratulations ${ownerData?.name ?? ""}! Log out and back in to activate Owner mode.`,
    }).catch(() => {});
  }

  // Step 5 (LAST): Mark the request as reviewed only after all side effects succeed
  const newStatus = action === "approve" ? "APPROVED" : "DECLINED";
  const { error: updateErr } = await db
    .from("OwnerRequest")
    .update({ status: newStatus, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    console.error("[admin/owner-requests PATCH update]", updateErr);
    return Response.json({ data: null, error: "Failed to update request" }, { status: 500 });
  }

  return Response.json({ data: { status: newStatus }, error: null });
}
