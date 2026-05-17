// src/app/api/telegram/webhook/route.ts
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage, generateTelegramCode } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  // Verify the request comes from Telegram (simple token check)
  const url = req.nextUrl;
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: { message?: { chat?: { id?: number }; text?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("OK", { status: 200 });
  }

  const chatId = body.message?.chat?.id?.toString();
  const text   = body.message?.text ?? "";

  if (!chatId || !text.startsWith("/start")) {
    return new Response("OK", { status: 200 });
  }

  const db   = getAdminClient();
  const code = generateTelegramCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Delete any existing codes for this chat_id before inserting a fresh one
  await db.from("TelegramCode").delete().eq("chat_id", chatId);

  await db.from("TelegramCode").insert({
    id: crypto.randomUUID(),
    code,
    chat_id: chatId,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  await sendTelegramMessage(
    chatId,
    `🌿 <b>Green Rides</b>\n\nYour linking code is: <b>${code}</b>\n\nEnter this in the app to link your Telegram account. Valid for 10 minutes.`
  );

  return new Response("OK", { status: 200 });
}
