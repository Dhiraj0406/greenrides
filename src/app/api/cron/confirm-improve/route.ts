import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const isInternal   = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !isInternal) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db  = getAdminClient();
  const now = new Date().toISOString();

  const { data: expired, error } = await db
    .from("ImprovementLog")
    .select("id, day")
    .eq("status", "live")
    .lt("veto_expires_at", now);

  if (error) {
    console.error("[confirm-improve]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return Response.json({ confirmed: 0 });
  }

  const ids = expired.map((r) => r.id);

  const { error: updateErr } = await db
    .from("ImprovementLog")
    .update({ status: "completed", completed_at: now })
    .in("id", ids);

  if (updateErr) {
    console.error("[confirm-improve update]", updateErr);
    return Response.json({ error: updateErr.message }, { status: 500 });
  }

  console.log(`[confirm-improve] Confirmed ${ids.length} improvement(s):`, expired.map((r) => r.day));
  return Response.json({ confirmed: ids.length, days: expired.map((r) => r.day) });
}
