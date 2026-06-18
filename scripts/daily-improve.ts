import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readBacklog, getNextPendingItem, updateBacklogItem } from "./lib/backlog.js";

const FORBIDDEN_PREFIXES = [
  "src/app/api/",
  "src/lib/supabase",
  "proxy.ts",
  ".env",
  "package.json",
  "package-lock.json",
];

const SYSTEM_PROMPT = `You are a senior frontend engineer implementing a specific UI improvement for Green Rides — an intercity cab booking app in Odisha, India built with Next.js 16 App Router and Tailwind CSS.

Design system tokens (ALWAYS use these, never raw hex or RGB):
- Text: text-forest (dark green headings), text-leaf (green actions), text-lime (light green on dark), text-sub (muted), text-text (body), text-gold (warnings/amber)
- Backgrounds: bg-cream (page bg), bg-pale (subtle fill), bg-forest (dark header), bg-white (cards)
- Border: border-border
- Fonts: font-display for Fraunces headings, font-mono-green for monospace
- Icons: from lucide-react only. Spinner: <Loader2 className="w-4 h-4 animate-spin" />
- Toasts: import { toast } from "sonner" — use toast.success / toast.error
- Supabase: import { supabase } from "@/lib/supabase" (client-side)
- Currency: always paise in DB. Display: Math.round(amount_paise / 100). Always prefix ₹.
- Timezone: Asia/Kolkata for all date formatting

Strict rules:
1. Modify ONLY the exact files provided. Do not reference or import files not shown.
2. Do NOT add new npm packages. Use only what is already imported in the file.
3. Do NOT change API routes, Supabase query logic, or authentication flows.
4. Do NOT add console.log statements.
5. Keep changes minimal and focused on the stated improvement only.
6. Match the existing code style exactly — same indentation, naming conventions, comment style.

Output format — output ONLY these XML blocks, no explanation, no markdown, no preamble:
<file path="src/app/example/page.tsx">
[complete new file content — every line, not a partial diff]
</file>`;

function parseFileBlocks(text: string): { path: string; content: string }[] {
  const pattern = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
  const files: { path: string; content: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].trim() });
  }
  return files;
}

async function main() {
  const dayOverride = process.env.DAY_OVERRIDE ? parseInt(process.env.DAY_OVERRIDE, 10) : undefined;

  const backlog = readBacklog();
  const item    = getNextPendingItem(backlog, dayOverride);

  if (!item) {
    console.log("🎉 No pending items — all 30 days complete!");
    process.exit(0);
  }

  console.log(`🚀 Day ${item.day}: ${item.title}`);

  const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasSupabase) {
    console.log("ℹ️  Supabase credentials not set — skipping log tracking");
  }

  let logId = "none";

  if (hasSupabase) {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const todayStr = new Date().toISOString().split("T")[0];
    const { data: existing } = await db
      .from("ImprovementLog")
      .select("id")
      .eq("day", item.day)
      .gte("created_at", `${todayStr}T00:00:00Z`)
      .maybeSingle();

    if (existing) {
      console.log("Already ran today (Supabase check) — exiting");
      process.exit(0);
    }

    const { data: logRow, error: logErr } = await db
      .from("ImprovementLog")
      .insert({
        day:           item.day,
        title:         item.title,
        portal:        item.portal,
        area:          item.area,
        status:        "building",
        files_changed: item.files,
      })
      .select("id")
      .single();

    if (logErr || !logRow) throw new Error(`Failed to create log row: ${logErr?.message}`);
    logId = logRow.id;
    console.log(`Log row created: ${logId}`);
  }

  const fileContents = item.files.map((filePath) => {
    const absPath = resolve(process.cwd(), filePath);
    try {
      const content = readFileSync(absPath, "utf-8");
      return `=== ${filePath} ===\n${content}`;
    } catch {
      return `=== ${filePath} ===\n(file does not exist yet — create it from scratch)`;
    }
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const userPrompt =
    `Improvement to implement:\n\n` +
    `Title: ${item.title}\n` +
    `Description: ${item.description}\n` +
    `Spec: ${item.prompt_hint}\n\n` +
    `Current file contents:\n\n${fileContents.join("\n\n")}`;

  console.log("Calling Claude API...");
  const message = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 8000,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userPrompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const fileChanges  = parseFileBlocks(responseText);

  if (fileChanges.length === 0) throw new Error("Claude returned no file blocks");
  if (fileChanges.length > 5)  throw new Error(`Safety: ${fileChanges.length} files exceeds limit of 5`);

  for (const { path: p } of fileChanges) {
    if (FORBIDDEN_PREFIXES.some((prefix) => p.startsWith(prefix))) {
      throw new Error(`Safety violation: forbidden path ${p}`);
    }
  }

  const newLines      = fileChanges.reduce((s, f) => s + f.content.split("\n").length, 0);
  const existingLines = item.files.reduce((s, fp) => {
    try { return s + readFileSync(resolve(process.cwd(), fp), "utf-8").split("\n").length; }
    catch { return s; }
  }, 0);
  const lineDiff = Math.abs(newLines - existingLines);
  if (lineDiff > 400) throw new Error(`Safety: diff of ${lineDiff} lines exceeds 400-line limit`);

  for (const { path: filePath, content } of fileChanges) {
    writeFileSync(resolve(process.cwd(), filePath), content + "\n");
    console.log(`  ✏️  Written: ${filePath}`);
  }

  updateBacklogItem(item.day, { status: "in_progress" });

  writeFileSync("/tmp/gr-day",   String(item.day));
  writeFileSync("/tmp/gr-title", item.title);
  writeFileSync("/tmp/gr-logid", logId);

  console.log(`✅ Phase 1 complete. Workflow will commit + push, then run post-deploy.ts`);
}

main().catch((err) => {
  console.error("❌ daily-improve failed:", err);
  process.exit(1);
});
