import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
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
    const { data: owner } = await db.from("Owner").select("id").eq("id", entity_id).eq("user_id", user.id).maybeSingle();
    if (!owner) return Response.json({ error: "Owner not found or not yours" }, { status: 403 });
  }
  if (entity_type === "VEHICLE") {
    const { data: vehicle } = await db.from("Vehicle").select("id, owner_id, Owner!owner_id(user_id)").eq("id", entity_id).maybeSingle();
    const ownerUserId = (vehicle?.Owner as unknown as { user_id: string } | null)?.user_id;
    if (!vehicle || ownerUserId !== user.id) {
      return Response.json({ error: "Vehicle not found or not yours" }, { status: 403 });
    }
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

  // Upsert Document record
  const { data: existing } = await db
    .from("Document")
    .select("id")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .eq("doc_type", doc_type)
    .maybeSingle();

  let docId: string;
  const now = new Date().toISOString();

  if (existing) {
    await db.from("Document").update({
      storage_path: storagePath,
      status:       "PENDING",
      verified_by:  null,
      verified_at:  null,
      updated_at:   now,
    }).eq("id", existing.id);
    docId = existing.id;
  } else {
    const { data: newDoc, error: createErr } = await db.from("Document").insert({
      entity_type,
      entity_id,
      doc_type,
      storage_path: storagePath,
    }).select("id").single();

    if (createErr || !newDoc) {
      return Response.json({ error: "Failed to save document record" }, { status: 500 });
    }
    docId = newDoc.id;
  }

  // Mark driver KYC as SUBMITTED (if it was NOT_SUBMITTED)
  if (entity_type === "DRIVER") {
    await db.from("DriverProfile")
      .update({ kyc_status: "SUBMITTED" })
      .eq("user_id", user.id)
      .eq("kyc_status", "NOT_SUBMITTED");
  }

  return Response.json({ data: { id: docId, storage_path: storagePath }, error: null });
}
