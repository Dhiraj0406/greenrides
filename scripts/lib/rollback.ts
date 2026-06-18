import { createClient } from "@supabase/supabase-js";
import { rollbackToPreviousDeployment } from "./vercel-api.js";
import { sendTelegramMessage } from "./telegram.js";

export async function rollbackImprovement(
  logId:  string,
  day:    number,
  title:  string,
): Promise<void> {
  console.log(`Rolling back day ${day}: ${title}`);

  let previousId = "unknown";
  try {
    previousId = await rollbackToPreviousDeployment();
    console.log(`Rolled back to deployment: ${previousId}`);
  } catch (err) {
    console.error("Vercel rollback API failed:", err);
    throw err;
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL && logId !== "none") {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    await db
      .from("ImprovementLog")
      .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
      .eq("id", logId);
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    await sendTelegramMessage(
      `↩️ <b>Day ${day} rolled back</b>\n\n` +
      `${title}\n\n` +
      `Previous version is live.\n` +
      `Reverted to deployment: ${previousId}`,
    );
  } else {
    console.log(`Rollback complete — day ${day} reverted to ${previousId}`);
  }
}
