import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const patchSchema = z.object({
  is_approved: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body  = await req.json();
    const input = patchSchema.parse(body);

    const updated = await (prisma as any).driverProfile.update({
      where: { id },
      data:  { is_approved: input.is_approved },
    });

    return Response.json({ data: updated, error: null });
  } catch (err) {
    console.error("[admin/drivers/[id] PATCH]", err);
    return Response.json(
      { data: null, error: "Failed to update driver" },
      { status: 500 }
    );
  }
}
