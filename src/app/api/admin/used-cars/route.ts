import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(l: any) {
  return { ...l, price_paise: l.price_paise.toString() };
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status") || undefined;

  const listings = await prisma.carListing.findMany({
    where:   status ? { status } : undefined,
    orderBy: { created_at: "desc" },
    include: { _count: { select: { inquiries: true } } },
  });

  const data = listings.map(({ _count, ...l }) => ({
    ...serialize(l),
    inquiry_count: _count.inquiries,
  }));

  return Response.json({ data, error: null });
}
