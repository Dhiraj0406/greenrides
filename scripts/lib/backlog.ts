import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

export interface BacklogItem {
  day:          number;
  title:        string;
  portal:       "rider" | "driver" | "fleet" | "admin" | "all";
  area:         "ux" | "feature" | "perf";
  description:  string;
  files:        string[];
  prompt_hint:  string;
  status:       "pending" | "in_progress" | "completed" | "rolled_back" | "skipped";
  completed_at: string | null;
  deployment_id: string | null;
}

export interface Backlog {
  items: BacklogItem[];
}

const BACKLOG_PATH = resolve(process.cwd(), "docs/improvements/backlog.json");

export function readBacklog(): Backlog {
  return JSON.parse(readFileSync(BACKLOG_PATH, "utf-8")) as Backlog;
}

export function writeBacklog(backlog: Backlog): void {
  writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2) + "\n");
}

export function updateBacklogItem(day: number, updates: Partial<BacklogItem>): void {
  const backlog = readBacklog();
  const idx     = backlog.items.findIndex((i) => i.day === day);
  if (idx === -1) throw new Error(`Backlog item for day ${day} not found`);
  backlog.items[idx] = { ...backlog.items[idx], ...updates };
  writeBacklog(backlog);
}

export function getNextPendingItem(backlog: Backlog, dayOverride?: number): BacklogItem | null {
  if (dayOverride) {
    return backlog.items.find((i) => i.day === dayOverride) ?? null;
  }
  return backlog.items.find((i) => i.status === "pending") ?? null;
}
