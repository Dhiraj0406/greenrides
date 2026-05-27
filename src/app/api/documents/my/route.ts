import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const docs = await prisma.document.findMany({
    where:   { entity_id: user.id },
    orderBy: { created_at: "desc" },
  });

  return Response.json({ data: docs, error: null });
}
