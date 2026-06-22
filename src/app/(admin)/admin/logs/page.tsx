"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, ChevronLeft, ClipboardList } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { toast } from "sonner";

interface LogEntry {
  id:         string;
  admin_id:   string;
  action:     string;
  entity:     string;
  entity_id:  string;
  details:    Record<string, unknown> | null;
  created_at: string;
}

const ENTITY_FILTERS = ["all", "driver", "owner", "vehicle", "booking", "fare", "document", "dispatch"];

const ACTION_LABELS: Record<string, string> = {
  driver_approved:     "Driver Approved",
  driver_rejected:     "Driver Rejected",
  driver_removed:      "Driver Removed",
  driver_created:      "Driver Created",
  owner_created:       "Owner Created",
  owner_activated:     "Owner Activated",
  owner_suspended:     "Owner Suspended",
  owner_removed:       "Owner Removed",
  vehicle_added:       "Vehicle Added",
  vehicle_activated:   "Vehicle Activated",
  vehicle_deactivated: "Vehicle Deactivated",
  vehicle_removed:     "Vehicle Removed",
  commission_updated:  "Commission Updated",
  fare_updated:        "Fare Updated",
  document_approved:   "Document Approved",
  document_rejected:   "Document Rejected",
  dispatch_assigned:   "Dispatch Assigned",
  dispatch_skipped:    "Dispatch Skipped",
};

function actionClass(action: string): string {
  if (action.includes("approved") || action.includes("created") || action.includes("activated"))
    return "bg-leaf/10 text-leaf";
  if (action.includes("rejected") || action.includes("removed"))
    return "bg-red-50 text-red-500";
  if (action.includes("suspended"))
    return "bg-amber-50 text-amber-600";
  if (action.includes("updated") || action.includes("assigned"))
    return "bg-blue-50 text-blue-600";
  return "bg-pale text-sub";
}

function fmtDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  const parts: string[] = [];
  if (details.name)           parts.push(String(details.name));
  if (details.phone)          parts.push(`+91 ${details.phone}`);
  if (details.number)         parts.push(String(details.number));
  if (details.make)           parts.push(`${details.make} ${details.model_name ?? ""}`);
  if (details.from !== undefined && details.to !== undefined)
    parts.push(`${details.from}% → ${details.to}%`);
  if (details.status)         parts.push(String(details.status));
  return parts.join(" · ");
}

function LogsContent({ token }: { token: string }) {
  const [logs,    setLogs]    = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity,  setEntity]  = useState("all");

  const load = useCallback((ent: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (ent !== "all") params.set("entity", ent);
    fetch(`/api/admin/logs?${params}`, { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setLogs(j.data ?? []))
      .catch(() => toast.error("Failed to load logs"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load("all"); }, [load]);

  function handleFilter(ent: string) {
    setEntity(ent);
    load(ent);
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4 sticky top-0 z-10">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Green Admin</p>
            <h1 className="font-display text-2xl text-white">Activity Log</h1>
          </div>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {ENTITY_FILTERS.map((f) => (
            <button key={f} onClick={() => handleFilter(f)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                entity === f ? "bg-lime text-forest" : "bg-white/10 text-lime/60 hover:text-lime"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}

        {!loading && logs.length === 0 && (
          <div className="text-center py-16">
            <ClipboardList className="w-10 h-10 text-sub/30 mx-auto mb-3" />
            <p className="text-sub text-sm">No activity logged yet.</p>
          </div>
        )}

        {!loading && logs.map((log, i) => (
          <div key={log.id} className="flex gap-3 mb-2">
            <div className="flex flex-col items-center pt-2">
              <div className="w-2 h-2 rounded-full bg-leaf flex-shrink-0" />
              {i < logs.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
            </div>
            <div className="bg-white border border-border rounded-2xl p-3 flex-1 mb-1">
              <div className="flex items-start justify-between gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${actionClass(log.action)}`}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-[10px] text-sub flex-shrink-0 whitespace-nowrap">{fmt(log.created_at)}</span>
              </div>
              {fmtDetails(log.details) && (
                <p className="text-xs text-text mt-1">{fmtDetails(log.details)}</p>
              )}
              <p className="text-[10px] text-sub font-mono-green mt-0.5 capitalize">{log.entity} · {log.entity_id.slice(0, 8)}…</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LogsPage() {
  return <AdminGate>{(token) => <LogsContent token={token} />}</AdminGate>;
}
