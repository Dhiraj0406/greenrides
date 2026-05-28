import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  buyer_name:  z.string().min(1).max(100),
  buyer_phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  message:     z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Listing must be APPROVED to accept inquiries
  const listing = await prisma.carListing.findUnique({
    where:  { id },
    select: { status: true },
  });

  if (!listing || listing.status !== "APPROVED") {
    return Response.json({ error: "Listing not available" }, { status: 403 });
  }

  await prisma.carInquiry.create({
    data: {
      listing_id:  id,
      buyer_name:  parsed.data.buyer_name,
      buyer_phone: parsed.data.buyer_phone,
      message:     parsed.data.message ?? null,
    },
  });

  return Response.json({ ok: true });
}
