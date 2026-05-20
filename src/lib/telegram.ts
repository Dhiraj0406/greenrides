const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    console.error("[telegram] sendMessage failed", await res.text());
  }
}

export function generateTelegramCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (100000 + (arr[0] % 900000)).toString();
}
