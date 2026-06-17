import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { readFileSync } from "fs";
import { resolve } from "path";

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

function readBacklogSafe() {
  try {
    const raw = readFileSync(resolve(process.cwd(), "docs/improvements/backlog.json"), "utf-8");
    return JSON.parse(raw) as { items: Array<{ day: number; title: string; portal: string; area: string; status: string }> };
  } catch {
    return { items: [] };
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();

  const [{ data: history }, { data: today }] = await Promise.all([
    db.from("ImprovementLog")
      .select("id, day, title, portal, area, status, deployment_url, smoke_tests_passed, veto_expires_at, completed_at, rolled_back_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    db.from("ImprovementLog")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const backlog  = readBacklogSafe();
  const upcoming = backlog.items
    .filter((i) => i.status === "pending")
    .slice(0, 7);

  const completed = (history ?? []).filter((r) => r.status === "completed" || r.status === "rolled_back").length;

  return Response.json({
    data: {
      today:     today ?? null,
      history:   history ?? [],
      upcoming,
      completed,
      total:     30,
    },
    error: null,
  });
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string; log_id?: string };

  if (body.action === "skip" && body.log_id) {
    const db = getAdminClient();
    const { error } = await db
      .from("ImprovementLog")
      .update({ status: "skipped" })
      .eq("id", body.log_id)
      .eq("status", "live");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data: { skipped: true }, error: null });
  }

  if (body.action === "rollback" && body.log_id) {
    const db = getAdminClient();
    const { data: log } = await db
      .from("ImprovementLog")
      .select("id, day, title, veto_expires_at")
      .eq("id", body.log_id)
      .eq("status", "live")
      .maybeSingle();

    if (!log) return Response.json({ error: "No live improvement found" }, { status: 404 });
    if (log.veto_expires_at && new Date(log.veto_expires_at) < new Date()) {
      return Response.json({ error: "Veto window has closed" }, { status: 400 });
    }

    const VERCEL_TOKEN      = process.env.VERCEL_TOKEN!;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;

    const deploysRes = await fetch(
      `https://api.vercel.com/v13/deployments?projectId=${VERCEL_PROJECT_ID}&limit=2&target=production`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
    );
    const deploysJson = await deploysRes.json() as { deployments: { uid: string }[] };
    const previous    = deploysJson.deployments?.[1];
    if (!previous) return Response.json({ error: "No previous deployment" }, { status: 500 });

    const rollbackRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/rollback/${previous.uid}`,
      { method: "POST", headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
    );
    if (!rollbackRes.ok) return Response.json({ error: "Rollback failed" }, { status: 500 });

    await db.from("ImprovementLog")
      .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
      .eq("id", log.id);

    return Response.json({ data: { rolled_back: true }, error: null });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
