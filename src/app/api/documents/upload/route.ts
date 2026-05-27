import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const DOC_TYPES = ["driving_license", "vehicle_rc", "vehicle_insurance", "aadhaar", "pan", "owner_id"] as const;

const metaSchema = z.object({
  entity_type: z.enum(["DRIVER", "VEHICLE", "OWNER"]),
  entity_id:   z.string().uuid(),
  doc_type:    z.enum(DOC_TYPES),
});

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file field required" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "File type not allowed. Use JPEG, PNG, WebP or PDF." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File too large (max 10 MB)" }, { status: 400 });

  const meta = metaSchema.safeParse({
    entity_type: formData.get("entity_type"),
    entity_id:   formData.get("entity_id"),
    doc_type:    formData.get("doc_type"),
  });
  if (!meta.success) return Response.json({ error: meta.error.issues[0].message }, { status: 400 });

  const { entity_type, entity_id, doc_type } = meta.data;

  // Ownership check
  if (entity_type === "DRIVER" && entity_id !== user.id) {
    return Response.json({ error: "entity_id must be your own user ID for DRIVER documents" }, { status: 403 });
  }
  if (entity_type === "OWNER") {
    const owner = await prisma.owner.findFirst({ where: { id: entity_id, user_id: user.id } });
    if (!owner) return Response.json({ error: "Owner not found or not yours" }, { status: 403 });
  }
  if (entity_type === "VEHICLE") {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: entity_id, owner: { user_id: user.id } },
    });
    if (!vehicle) return Response.json({ error: "Vehicle not found or not yours" }, { status: 403 });
  }

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${entity_type}/${entity_id}/${doc_type}_${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await db.storage
    .from("kyc-documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) {
    console.error("[documents/upload]", uploadErr);
    return Response.json({ error: "Storage upload failed" }, { status: 500 });
  }

  // Upsert Document record (replace if same entity+doc_type exists)
  const existing = await prisma.document.findFirst({
    where: { entity_type: entity_type as "DRIVER" | "VEHICLE" | "OWNER", entity_id, doc_type },
  });

  let doc;
  if (existing) {
    doc = await prisma.document.update({
      where: { id: existing.id },
      data:  { storage_path: storagePath, status: "PENDING", verified_by: null, verified_at: null, updated_at: new Date() },
    });
  } else {
    doc = await prisma.document.create({
      data: { entity_type: entity_type as "DRIVER" | "VEHICLE" | "OWNER", entity_id, doc_type, storage_path: storagePath },
    });
  }

  // Mark driver KYC as SUBMITTED (if it was NOT_SUBMITTED)
  if (entity_type === "DRIVER") {
    await prisma.driverProfile.updateMany({
      where: { user_id: user.id, kyc_status: "NOT_SUBMITTED" },
      data:  { kyc_status: "SUBMITTED" },
    });
  }

  return Response.json({ data: { id: doc.id, storage_path: storagePath }, error: null });
}
