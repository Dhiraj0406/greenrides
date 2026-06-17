import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const schema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });

  try {
    const db = getAdminClient();

    const { data: doc } = await db.from("Document").select("*").eq("id", id).single();
    if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

    const newStatus = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
    const now = new Date().toISOString();

    await db.from("Document").update({ status: newStatus, verified_by: "admin", verified_at: now }).eq("id", id);

    await db.from("AdminLog").insert({
      admin_id: "admin",
      action:   `document_${parsed.data.action}`,
      entity:   "Document",
      entity_id: id,
      details:  { doc_type: doc.doc_type, entity_type: doc.entity_type, entity_id: doc.entity_id },
    });

    if (doc.entity_type === "DRIVER" && newStatus === "APPROVED") {
      const { count } = await db.from("Document")
        .select("*", { count: "exact", head: true })
        .eq("entity_type", "DRIVER")
        .eq("entity_id", doc.entity_id)
        .neq("status", "APPROVED");

      if (count === 0) {
        await db.from("DriverProfile").update({ kyc_status: "APPROVED" }).eq("user_id", doc.entity_id);
      }
    }

    if (doc.entity_type === "DRIVER" && newStatus === "REJECTED") {
      await db.from("DriverProfile").update({ kyc_status: "REJECTED" }).eq("user_id", doc.entity_id);
    }

    return Response.json({ data: { ok: true, status: newStatus }, error: null });
  } catch (err) {
    console.error("[admin/documents/:id/verify POST]", err);
    return Response.json({ error: "Failed to verify document" }, { status: 500 });
  }
}
