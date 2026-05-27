import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const adminClient = getAdminClient();
  const { data: { user }, error } = await adminClient.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles: string[] = (user.app_metadata?.roles as string[]) ?? [];
  if (!roles.includes("owner")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Return all approved drivers so owners can assign any to their vehicles
  const drivers = await prisma.driverProfile.findMany({
    where:   { is_approved: true },
    include: { user: { select: { name: true, phone: true } }, vehicles: true },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ data: drivers });
}
