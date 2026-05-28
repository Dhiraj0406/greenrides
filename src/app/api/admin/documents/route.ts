import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url    = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;

  const docs = await prisma.document.findMany({
    where:   status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : undefined,
    orderBy: { created_at: "desc" },
  });

  if (docs.length === 0) return Response.json({ data: [], error: null });

  // Generate 1-hour signed URLs so admin can preview each file
  const db     = getAdminClient();
  const paths  = docs.map((d) => ({ name: d.storage_path }));
  const { data: signedUrls } = await db.storage
    .from("kyc-documents")
    .createSignedUrls(paths.map((p) => p.name), 3600);

  const urlMap = new Map(
    (signedUrls ?? [])
      .filter((s): s is { path: string; signedUrl: string; error: null } => s.path !== null && s.signedUrl !== null)
      .map((s) => [s.path, s.signedUrl])
  );

  // Enrich with uploader name/phone from User table (DRIVER entity_id = user_id)
  const userIds = docs
    .filter((d) => d.entity_type === "DRIVER")
    .map((d) => d.entity_id);

  const users = userIds.length
    ? await prisma.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true, phone: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const data = docs.map((d) => ({
    ...d,
    signed_url: urlMap.get(d.storage_path) ?? null,
    uploader:   d.entity_type === "DRIVER" ? (userMap.get(d.entity_id) ?? null) : null,
  }));

  return Response.json({ data, error: null });
}
