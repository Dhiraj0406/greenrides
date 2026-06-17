import { createClient } from "@supabase/supabase-js";
import { rollbackToPreviousDeployment } from "./vercel-api.js";
import { sendTelegramMessage } from "./telegram.js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function rollbackImprovement(
  logId:  string,
  day:    number,
  title:  string,
): Promise<void> {
  const db = getSupabase();
  console.log(`Rolling back day ${day}: ${title}`);

  let previousId = "unknown";
  try {
    previousId = await rollbackToPreviousDeployment();
    console.log(`Rolled back to deployment: ${previousId}`);
  } catch (err) {
    console.error("Vercel rollback API failed:", err);
    throw err;
  }

  await db
    .from("ImprovementLog")
    .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
    .eq("id", logId);

  await sendTelegramMessage(
    `↩️ <b>Day ${day} rolled back</b>\n\n` +
    `${title}\n\n` +
    `Previous version is live.\n` +
    `Reverted to deployment: ${previousId}`,
  );
}
