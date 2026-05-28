import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const inquiries = await prisma.carInquiry.findMany({
    where:   { listing_id: id },
    orderBy: { created_at: "desc" },
  });

  return Response.json({ data: inquiries, error: null });
}
