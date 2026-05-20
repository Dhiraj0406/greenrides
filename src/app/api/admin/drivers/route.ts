import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const approved = searchParams.get("approved");
    const q        = searchParams.get("q") ?? "";

    const where: Record<string, unknown> = {};
    if (approved === "1") where.is_approved = true;
    if (q) {
      where.OR = [
        { user: { name:  { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q, mode: "insensitive" } } },
      ];
    }

    const drivers = await prisma.driverProfile.findMany({
      where,
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { created_at: "desc" },
    });

    const data = drivers.map((dp: any) => ({
      id:    dp.id,
      name:  dp.user?.name  ?? null,
      phone: dp.user?.phone ?? "",
    }));

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/drivers GET]", err);
    return Response.json(
      { data: null, error: "Failed to fetch drivers" },
      { status: 500 }
    );
  }
}
