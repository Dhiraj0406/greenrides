import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidateFlag } from "@/modules/platform/db";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const schema = z.object({ enabled: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const flag = await prisma.appRemoteConfig.update({
    where: { key },
    data:  { enabled: parsed.data.enabled },
  });

  invalidateFlag(key);

  return Response.json({ data: flag, error: null });
}
