import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { pollDeploymentReady, rollbackToPreviousDeployment } from "./lib/vercel-api.js";
import { runSmokeTests } from "./lib/smoke-test.js";
import { sendTelegramMessage } from "./lib/telegram.js";
import { rollbackImprovement } from "./lib/rollback.js";
import { updateBacklogItem } from "./lib/backlog.js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function main() {
  const logId    = readFileSync("/tmp/gr-logid",  "utf-8").trim();
  const day      = parseInt(readFileSync("/tmp/gr-day",   "utf-8").trim(), 10);
  const title    = readFileSync("/tmp/gr-title", "utf-8").trim();
  const pushedAt = parseInt(process.env.PUSHED_AT ?? String(Date.now()), 10);

  console.log(`📡 Post-deploy: day ${day} — ${title}`);
  const db = getSupabase();

  let deployment;
  try {
    deployment = await pollDeploymentReady(pushedAt);
  } catch (err) {
    console.error("Deploy polling timed out:", err);
    await db.from("ImprovementLog")
      .update({ status: "failed", notes: "Deployment timed out" })
      .eq("id", logId);
    await sendTelegramMessage(
      `⚠️ <b>Day ${day} — deploy timed out</b>\n\n${title}\n\nNo auto-rollback needed (deploy never completed). Will retry tomorrow.`,
    );
    process.exit(1);
  }

  if (deployment.readyState === "ERROR") {
    console.error("Deployment errored");
    await db.from("ImprovementLog")
      .update({ status: "failed", deployment_id: deployment.uid, notes: "Vercel build error" })
      .eq("id", logId);
    await sendTelegramMessage(
      `⚠️ <b>Day ${day} — build failed</b>\n\n${title}\n\nVercel build error. Check Vercel dashboard. Previous version untouched.`,
    );
    process.exit(1);
  }

  console.log(`✅ Deploy READY: ${deployment.uid}`);

  const smoke = await runSmokeTests();
  console.log(`Smoke tests: ${smoke.results.filter((r) => r.ok).length}/${smoke.results.length} passed`);

  if (!smoke.passed) {
    const failed = smoke.results.filter((r) => !r.ok).map((r) => r.url).join(", ");
    console.error("Smoke tests failed — rolling back:", failed);
    try {
      await rollbackImprovement(logId, day, title);
    } catch (rollbackErr) {
      console.error("Rollback itself failed:", rollbackErr);
    }
    await db.from("ImprovementLog")
      .update({ status: "failed", deployment_id: deployment.uid, smoke_tests_passed: false, notes: `Smoke fail: ${failed}` })
      .eq("id", logId);
    process.exit(1);
  }

  const vetoExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await db.from("ImprovementLog").update({
    status:             "live",
    deployment_id:      deployment.uid,
    deployment_url:     `https://${deployment.url}`,
    smoke_tests_passed: true,
    veto_expires_at:    vetoExpiresAt,
  }).eq("id", logId);

  updateBacklogItem(day, { deployment_id: deployment.uid });

  const confirmTime = new Date(vetoExpiresAt).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
  });

  await sendTelegramMessage(
    `🟢 <b>Day ${day} live — greenrides.co.in</b>\n\n` +
    `📌 <b>${title}</b>\n\n` +
    `✅ Build passed · Smoke tests ${smoke.results.filter((r) => r.ok).length}/5\n` +
    `🔗 greenrides.co.in\n\n` +
    `Reply <b>ROLLBACK</b> within 30 min to revert.\n` +
    `Auto-confirmed at ${confirmTime} IST.`,
  );

  console.log(`🎉 Day ${day} complete and live!`);
}

main().catch((err) => {
  console.error("❌ post-deploy failed:", err);
  process.exit(1);
});
