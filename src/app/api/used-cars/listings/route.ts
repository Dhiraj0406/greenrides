import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET        = "used-car-photos";
const MAX_PHOTOS    = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const schema = z.object({
  make:         z.string().min(1).max(60),
  model:        z.string().min(1).max(60),
  year:         z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  price_paise:  z.coerce.number().int().positive(),
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
    return Response.json({ data: null, error: "Invalid form data" }, { status: 400 });
  }

  const raw: Record<string, string> = {};
  for (const key of TEXT_FIELDS) {
    const val = formData.get(key);
    if (val !== null && typeof val === "string") raw[key] = val;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_PHOTOS) {
    return Response.json({ data: null, error: "Maximum 6 photos allowed" }, { status: 400 });
  }
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ data: null, error: `Photo "${file.name}" exceeds 5 MB limit` }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return Response.json({ data: null, error: "Only image files are allowed" }, { status: 400 });
    }
  }

  const listingId     = randomUUID();
  const photoUrls:     string[] = [];
  const uploadedPaths: string[] = [];

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
        return Response.json({ data: null, error: "Photo upload failed" }, { status: 500 });
      }

      uploadedPaths.push(path);
      const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path);
      photoUrls.push(urlData.publicUrl);
    }
  }

  const db = getAdminClient();
  const { data: listing, error: insertErr } = await db
    .from("CarListing")
    .insert({
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
    })
    .select("id")
    .single();

  if (insertErr || !listing) {
    console.error("[used-cars/listings POST] db error:", insertErr);
    if (uploadedPaths.length > 0) {
      try {
        await getAdminClient().storage.from(BUCKET).remove(uploadedPaths);
      } catch (cleanupErr) {
        console.error("[used-cars/listings POST] storage cleanup error:", cleanupErr);
      }
    }
    return Response.json({ data: null, error: "Failed to create listing" }, { status: 500 });
  }

  return Response.json({ data: { id: listing.id }, error: null });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(l: any) {
  return { ...l, price_paise: String(l.price_paise) };
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

  let minPriceNum: number | undefined;
  let maxPriceNum: number | undefined;
  if (minPrice) {
    minPriceNum = Number(minPrice);
    if (!Number.isFinite(minPriceNum)) {
      return Response.json({ data: null, error: "Invalid price filter" }, { status: 400 });
    }
  }
  if (maxPrice) {
    maxPriceNum = Number(maxPrice);
    if (!Number.isFinite(maxPriceNum)) {
      return Response.json({ data: null, error: "Invalid price filter" }, { status: 400 });
    }
  }

  try {
    const db = getAdminClient();

    let dataQ = db
      .from("CarListing")
      .select("*")
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false })
      .range(skip, skip + limit - 1);

    let countQ = db
      .from("CarListing")
      .select("*", { count: "exact", head: true })
      .eq("status", "APPROVED");

    if (make) {
      dataQ  = dataQ.ilike("make", `%${make}%`);
      countQ = countQ.ilike("make", `%${make}%`);
    }
    if (fuelType) {
      dataQ  = dataQ.eq("fuel_type", fuelType);
      countQ = countQ.eq("fuel_type", fuelType);
    }
    if (minPriceNum !== undefined) {
      dataQ  = dataQ.gte("price_paise", minPriceNum);
      countQ = countQ.gte("price_paise", minPriceNum);
    }
    if (maxPriceNum !== undefined) {
      dataQ  = dataQ.lte("price_paise", maxPriceNum);
      countQ = countQ.lte("price_paise", maxPriceNum);
    }

    const [{ data: listings, error: listErr }, { count, error: countErr }] = await Promise.all([dataQ, countQ]);

    if (listErr || countErr) {
      console.error("[used-cars/listings GET]", listErr ?? countErr);
      return Response.json({ data: null, error: "Failed to fetch listings" }, { status: 500 });
    }

    return Response.json({ data: (listings ?? []).map(serialize), total: count ?? 0, page, error: null });
  } catch (err) {
    console.error("[used-cars/listings GET]", err);
    return Response.json({ data: null, error: "Failed to fetch listings" }, { status: 500 });
  }
}
