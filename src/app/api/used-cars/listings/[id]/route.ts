import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(l: any) {
  return { ...l, price_paise: l.price_paise.toString() };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const listing = await prisma.carListing.findUnique({ where: { id } });

  if (!listing || listing.status === "PENDING" || listing.status === "REJECTED") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: serialize(listing), error: null });
}
