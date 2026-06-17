import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url    = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;

  try {
    const db = getAdminClient();
    let query = db
      .from("Document")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data: docs, error } = await query;
    if (error) throw error;
    if (!docs?.length) return Response.json({ data: [], error: null });

    // Generate 1-hour signed URLs so admin can preview each file
    const { data: signedUrls } = await db.storage
      .from("kyc-documents")
      .createSignedUrls(docs.map((d) => d.storage_path), 3600);

    const urlMap = new Map(
      (signedUrls ?? [])
        .filter((s): s is { path: string; signedUrl: string; error: null } => !!s.path && !!s.signedUrl)
        .map((s) => [s.path, s.signedUrl])
    );

    // Enrich with uploader name/phone for DRIVER documents
    const userIds = docs.filter((d) => d.entity_type === "DRIVER").map((d) => d.entity_id);
    let userMap = new Map<string, { id: string; name: string | null; phone: string }>();
    if (userIds.length) {
      const { data: users } = await db
        .from("User")
        .select("id, name, phone")
        .in("id", userIds);
      userMap = new Map((users ?? []).map((u) => [u.id, u]));
    }

    const data = docs.map((d) => ({
      ...d,
      signed_url: urlMap.get(d.storage_path) ?? null,
      uploader:   d.entity_type === "DRIVER" ? (userMap.get(d.entity_id) ?? null) : null,
    }));

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/documents GET]", err);
    return Response.json({ data: null, error: "Failed to fetch documents" }, { status: 500 });
  }
}
