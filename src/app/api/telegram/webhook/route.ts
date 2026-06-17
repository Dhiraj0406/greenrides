import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendTelegramMessage, generateTelegramCode } from "@/lib/telegram";

async function handleRollback(db: ReturnType<typeof getAdminClient>, chatId: string): Promise<string> {
  const { data: log } = await db
    .from("ImprovementLog")
    .select("id, day, title, veto_expires_at, deployment_id")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return "⚠️ No live improvement found to rollback.";
  if (!log.veto_expires_at || new Date(log.veto_expires_at) < new Date()) {
    return "⏰ Veto window has closed — rollback is no longer available.";
  }

  const VERCEL_TOKEN      = process.env.VERCEL_TOKEN!;
  const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;

  const deploysRes = await fetch(
    `https://api.vercel.com/v13/deployments?projectId=${VERCEL_PROJECT_ID}&limit=2&target=production`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  );
  const deploysJson = await deploysRes.json() as { deployments: { uid: string }[] };
  const previous    = deploysJson.deployments?.[1];
  if (!previous) return "⚠️ No previous deployment found.";

  const rollbackRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/rollback/${previous.uid}`,
    { method: "POST", headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  );
  if (!rollbackRes.ok) return `⚠️ Rollback API failed: ${rollbackRes.status}`;

  await db.from("ImprovementLog")
    .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
    .eq("id", log.id);

  return `↩️ <b>Day ${log.day} rolled back</b>\n\n${log.title}\n\nPrevious version is live.`;
}

async function handleStatus(db: ReturnType<typeof getAdminClient>): Promise<string> {
  const { data: log } = await db
    .from("ImprovementLog")
    .select("day, title, portal, status, deployment_url, veto_expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return "No improvements logged yet.";

  const statusEmoji: Record<string, string> = {
    building:     "🔄",
    live:         "🟢",
    completed:    "✅",
    rolled_back:  "↩️",
    failed:       "⚠️",
    skipped:      "⏭️",
  };
  const emoji = statusEmoji[log.status] ?? "❓";
  const vetoInfo = log.veto_expires_at && log.status === "live"
    ? `\nRollback available until ${new Date(log.veto_expires_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST`
    : "";

  return `${emoji} <b>Day ${log.day}</b> — ${log.status.toUpperCase()}\n\n${log.title}\nPortal: ${log.portal}${vetoInfo}`;
}

async function handleSkip(db: ReturnType<typeof getAdminClient>): Promise<string> {
  const { data: log } = await db
    .from("ImprovementLog")
    .select("id, day, title")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return "⚠️ No live improvement to skip.";

  await db.from("ImprovementLog")
    .update({ status: "skipped" })
    .eq("id", log.id);

  return `⏭️ Day ${log.day} marked as skipped.\n\n${log.title}\n\nTomorrow's improvement runs as scheduled. To re-run this day, manually set its status back to "pending" in backlog.json.`;
}

export async function POST(req: NextRequest) {
  const url    = req.nextUrl;
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
  const text   = (body.message?.text ?? "").trim().toUpperCase();

  if (!chatId) return new Response("OK", { status: 200 });

  const db = getAdminClient();

  if (text === "ROLLBACK") {
    const reply = await handleRollback(db, chatId);
    await sendTelegramMessage(chatId, reply);
    return new Response("OK", { status: 200 });
  }

  if (text === "STATUS") {
    const reply = await handleStatus(db);
    await sendTelegramMessage(chatId, reply);
    return new Response("OK", { status: 200 });
  }

  if (text === "SKIP") {
    const reply = await handleSkip(db);
    await sendTelegramMessage(chatId, reply);
    return new Response("OK", { status: 200 });
  }

  if (!text.startsWith("/START")) {
    return new Response("OK", { status: 200 });
  }

  const code       = generateTelegramCode();
  const expiresAt  = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.from("TelegramCode").delete().eq("chat_id", chatId);
  await db.from("TelegramCode").insert({
    id:         crypto.randomUUID(),
    code,
    chat_id:    chatId,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  await sendTelegramMessage(
    chatId,
    `🌿 <b>Green Rides</b>\n\nYour linking code is: <b>${code}</b>\n\nEnter this in the app to link your Telegram account. Valid for 10 minutes.`,
  );

  return new Response("OK", { status: 200 });
}
