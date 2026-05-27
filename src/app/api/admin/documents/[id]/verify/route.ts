import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

  const newStatus = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
  const now = new Date();

  await prisma.document.update({
    where: { id },
    data:  { status: newStatus, verified_by: "admin", verified_at: now, updated_at: now },
  });

  // Log to AdminLog
  await prisma.adminLog.create({
    data: {
      admin_id:  "admin",
      action:    `document_${parsed.data.action}`,
      entity:    "Document",
      entity_id: id,
      details:   { doc_type: doc.doc_type, entity_type: doc.entity_type, entity_id: doc.entity_id },
    },
  });

  // If all DRIVER docs are approved → promote kyc_status to APPROVED
  if (doc.entity_type === "DRIVER" && newStatus === "APPROVED") {
    const pendingCount = await prisma.document.count({
      where: { entity_type: "DRIVER", entity_id: doc.entity_id, status: { not: "APPROVED" } },
    });
    if (pendingCount === 0) {
      await prisma.driverProfile.updateMany({
        where: { user_id: doc.entity_id },
        data:  { kyc_status: "APPROVED" },
      });
    }
  }

  // If any doc is REJECTED → set kyc_status to REJECTED
  if (doc.entity_type === "DRIVER" && newStatus === "REJECTED") {
    await prisma.driverProfile.updateMany({
      where: { user_id: doc.entity_id },
      data:  { kyc_status: "REJECTED" },
    });
  }

  return Response.json({ data: { ok: true, status: newStatus }, error: null });
}
