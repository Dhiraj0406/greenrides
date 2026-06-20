import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

async function getUser(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const db = getAdminClient();
  const { data } = await db.auth.getUser(token);
  return data.user ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data, error } = await db
    .from("OwnerRequest")
    .select("id, vehicle_count, reason, status, created_at, reviewed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[fleet/owner-request GET]", error);
    return Response.json({ data: null, error: "Failed to fetch request" }, { status: 500 });
  }
  return Response.json({ data, error: null });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const roles: string[] = (user.app_metadata?.roles as string[]) ?? [];
  if (roles.includes("owner")) {
    return Response.json({ data: null, error: "Already an owner" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const { vehicle_count, reason } = (body ?? {}) as { vehicle_count?: number; reason?: string };

  if (!vehicle_count || vehicle_count < 2) {
    return Response.json({ data: null, error: "Must declare at least 2 vehicles" }, { status: 400 });
  }
  if (!reason || reason.trim().length < 10) {
    return Response.json({ data: null, error: "Reason must be at least 10 characters" }, { status: 400 });
  }
  if (reason.trim().length > 200) {
    return Response.json({ data: null, error: "Reason must be 200 characters or less" }, { status: 400 });
  }

  const db = getAdminClient();

  // Check for existing PENDING request
  const { data: existing } = await db
    .from("OwnerRequest")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "PENDING")
    .maybeSingle();

  if (existing) {
    return Response.json({ data: null, error: "Request already pending" }, { status: 409 });
  }

  const { data, error } = await db
    .from("OwnerRequest")
    .insert({ user_id: user.id, vehicle_count, reason: reason.trim() })
    .select()
    .single();

  if (error) {
    console.error("[fleet/owner-request POST]", error);
    return Response.json({ data: null, error: "Failed to submit request" }, { status: 500 });
  }
  return Response.json({ data, error: null }, { status: 201 });
}
