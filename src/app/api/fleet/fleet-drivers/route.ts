import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const roles: string[] = (user.app_metadata?.roles as string[]) ?? [];
  if (!roles.includes("owner")) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });

  try {
    const { data: owner } = await db.from("Owner").select("id, status").eq("user_id", user.id).maybeSingle();
    if (!owner) return NextResponse.json({ data: [], error: null });
    if (owner.status !== "ACTIVE") return NextResponse.json({ data: null, error: "Account not active" }, { status: 403 });

    const { data: drivers, error } = await db
      .from("DriverProfile")
      .select("*, user:user_id(name, phone)")
      .eq("owner_id", owner.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: drivers ?? [], error: null });
  } catch (err) {
    console.error("[fleet-drivers GET]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch drivers" }, { status: 500 });
  }
}
