import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const flags = await prisma.appRemoteConfig.findMany({ orderBy: [{ module_scope: "asc" }, { key: "asc" }] });
  return Response.json({ data: flags, error: null });
}
