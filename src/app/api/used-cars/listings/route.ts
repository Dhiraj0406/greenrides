import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET        = "used-car-photos";
const MAX_PHOTOS    = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const schema = z.object({
  make:         z.string().min(1).max(60),
  model:        z.string().min(1).max(60),
  year:         z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  price_paise:  z.coerce.bigint().positive(),
  mileage_km:   z.coerce.number().int().positive().optional(),
  fuel_type:    z.enum(["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"]),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]),
  location:     z.string().min(1).max(100),
  description:  z.string().max(1000).optional(),
  seller_name:  z.string().min(1).max(100),
  seller_phone: z.string().regex(/^\+?[0-9]{10,15}$/),
});

const TEXT_FIELDS = [
  "make","model","year","price_paise","mileage_km",
  "fuel_type","transmission","location","description",
  "seller_name","seller_phone",
] as const;

export async function POST(request: NextRequest) {
  let formData: FormData;
  try { formData = await request.formData(); } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  // Extract text fields
  const raw: Record<string, string> = {};
  for (const key of TEXT_FIELDS) {
    const val = formData.get(key);
    if (val !== null && typeof val === "string") raw[key] = val;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Validate photo files
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_PHOTOS) {
    return Response.json({ error: "Maximum 6 photos allowed" }, { status: 400 });
  }
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: `Photo "${file.name}" exceeds 5 MB limit` }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "Only image files are allowed" }, { status: 400 });
    }
  }

  // Generate listing ID upfront so storage paths include it
  const listingId     = randomUUID();
  const photoUrls:     string[] = [];
  const uploadedPaths: string[] = [];

  // Only instantiate the admin client when there are photos to upload
  if (files.length > 0) {
    const db = getAdminClient();
    for (const file of files) {
      const ext      = (file.name.split(".").pop() || "jpg").toLowerCase();
      const filename = `${randomUUID()}.${ext}`;
      const path     = `${listingId}/${filename}`;
      const buffer   = Buffer.from(await file.arrayBuffer());

      const { error: uploadErr } = await db.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: file.type });

      if (uploadErr) {
        console.error("[used-cars/listings POST] upload error:", uploadErr);
        if (uploadedPaths.length > 0) {
          await db.storage.from(BUCKET).remove(uploadedPaths);
        }
        return Response.json({ error: "Photo upload failed" }, { status: 500 });
      }

      uploadedPaths.push(path);
      const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path);
      photoUrls.push(urlData.publicUrl);
    }
  }

  // Create listing row (status defaults to PENDING)
  try {
    const listing = await prisma.carListing.create({
      data: {
        id:           listingId,
        make:         parsed.data.make,
        model:        parsed.data.model,
        year:         parsed.data.year,
        price_paise:  parsed.data.price_paise,
        mileage_km:   parsed.data.mileage_km ?? null,
        fuel_type:    parsed.data.fuel_type,
        transmission: parsed.data.transmission,
        location:     parsed.data.location,
        description:  parsed.data.description ?? null,
        seller_name:  parsed.data.seller_name,
        seller_phone: parsed.data.seller_phone,
        photos:       photoUrls,
      },
    });
    return Response.json({ id: listing.id, ok: true });
  } catch (err) {
    console.error("[used-cars/listings POST] db error:", err);
    if (uploadedPaths.length > 0) {
      try {
        await getAdminClient().storage.from(BUCKET).remove(uploadedPaths);
      } catch (cleanupErr) {
        console.error("[used-cars/listings POST] storage cleanup error:", cleanupErr);
      }
    }
    return Response.json({ error: "Failed to create listing" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(l: any) {
  return { ...l, price_paise: l.price_paise.toString() };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page     = Math.max(1, parseInt(searchParams.get("page")  || "1",  10));
  const limit    = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));
  const skip     = (page - 1) * limit;
  const make     = searchParams.get("make")      || undefined;
  const fuelType = searchParams.get("fuel_type") || undefined;
  const minPrice = searchParams.get("min_price") || undefined;
  const maxPrice = searchParams.get("max_price") || undefined;

  // Validate BigInt price params
  let minPriceBigInt: bigint | undefined;
  let maxPriceBigInt: bigint | undefined;
  try {
    if (minPrice) minPriceBigInt = BigInt(minPrice);
    if (maxPrice) maxPriceBigInt = BigInt(maxPrice);
  } catch {
    return Response.json({ error: "Invalid price filter" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    status: "APPROVED",
    ...(make     ? { make: { contains: make, mode: "insensitive" } } : {}),
    ...(fuelType ? { fuel_type: fuelType }                           : {}),
    ...(minPriceBigInt || maxPriceBigInt ? {
      price_paise: {
        ...(minPriceBigInt ? { gte: minPriceBigInt } : {}),
        ...(maxPriceBigInt ? { lte: maxPriceBigInt } : {}),
      },
    } : {}),
  };

  const [listings, total] = await Promise.all([
    prisma.carListing.findMany({ where, orderBy: { created_at: "desc" }, skip, take: limit }),
    prisma.carListing.count({ where }),
  ]);

  return Response.json({ data: listings.map(serialize), total, page, error: null });
}
