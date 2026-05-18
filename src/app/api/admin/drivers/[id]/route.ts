// src/app/api/admin/drivers/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const patchSchema = z.object({ is_approved: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body   = await req.json();
  const input  = patchSchema.parse(body);

  const updated = await (prisma as any).driverProfile.update({
    where: { id },
    data:  {
      is_approved: input.is_approved,
      approved_at: input.is_approved ? new Date() : null,
    },
    include: { user: { select: { name: true } } },
  });

  // Send Telegram notification when approving
  if (input.is_approved && updated.telegram_chat_id) {
    await sendTelegramMessage(
      updated.telegram_chat_id,
      `✅ <b>You're approved on Green Rides!</b>\n\nWelcome, ${updated.user?.name ?? "Driver"}! Open the app to set your schedule and go online.\n\nhttps://green-rides.vercel.app/drivers/dashboard`
    );
  }

  return Response.json({ data: updated, error: null });
}
