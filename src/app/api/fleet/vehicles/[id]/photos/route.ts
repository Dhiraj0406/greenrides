import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 5;
const BUCKET = "kyc-documents";

async function ownerFromToken(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const db = getAdminClient();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: owner } = await db
    .from("Owner")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return owner;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await ownerFromToken(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getAdminClient();

  const { data: vehicle } = await db
    .from("Vehicle")
    .select("id, photos")
    .eq("id", id)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (!vehicle) return Response.json({ data: null, error: "Not found" }, { status: 404 });

  const currentPhotos: string[] = Array.isArray(vehicle.photos) ? vehicle.photos : [];
  if (currentPhotos.length >= MAX_PHOTOS) {
    return Response.json({ data: null, error: `Maximum ${MAX_PHOTOS} photos allowed` }, { status: 400 });
  }

  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return Response.json({ data: null, error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ data: null, error: "file field required" }, { status: 400 });
  if (!ALLOWED.has(file.type))  return Response.json({ data: null, error: "Images only (JPEG, PNG, WebP)" }, { status: 400 });
  if (file.size > MAX_BYTES)    return Response.json({ data: null, error: "Max 10 MB per photo" }, { status: 400 });

  const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `VEHICLE/${id}/photos/${Date.now()}.${ext}`;
  const buf  = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false });

  if (uploadErr) {
    console.error("[vehicle/photos POST]", uploadErr);
    return Response.json({ data: null, error: "Storage upload failed" }, { status: 500 });
  }

  const newPhotos = [...currentPhotos, path];
  const { error: updateErr } = await db
    .from("Vehicle")
    .update({ photos: newPhotos })
    .eq("id", id);

  if (updateErr) {
    console.error("[vehicle/photos POST update]", updateErr);
    return Response.json({ data: null, error: "Failed to save photo reference" }, { status: 500 });
  }

  return Response.json({ data: { photos: newPhotos }, error: null });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await ownerFromToken(req);
  if (!owner) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getAdminClient();

  const { data: vehicle } = await db
    .from("Vehicle")
    .select("id, photos")
    .eq("id", id)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (!vehicle) return Response.json({ data: null, error: "Not found" }, { status: 404 });

  const { path } = (await req.json().catch(() => ({}))) as { path?: string };
  const currentPhotos: string[] = Array.isArray(vehicle.photos) ? vehicle.photos : [];

  if (!path || !currentPhotos.includes(path)) {
    return Response.json({ data: null, error: "Photo path not found" }, { status: 400 });
  }

  const { error: removeErr } = await db.storage.from(BUCKET).remove([path]);
  if (removeErr) {
    console.error("[vehicle/photos DELETE] storage remove error:", removeErr);
    return Response.json({ data: null, error: "Failed to remove photo from storage" }, { status: 500 });
  }

  const newPhotos = currentPhotos.filter((p) => p !== path);
  const { error: updateErr } = await db
    .from("Vehicle")
    .update({ photos: newPhotos })
    .eq("id", id);

  if (updateErr) {
    return Response.json({ data: null, error: "Failed to remove photo reference" }, { status: 500 });
  }

  return Response.json({ data: { photos: newPhotos }, error: null });
}
