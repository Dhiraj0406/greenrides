"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, AlertCircle, RotateCcw, SkipForward, ExternalLink, TrendingUp, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface LogRow {
  id:                 string;
  day:                number;
  title:              string;
  portal:             string;
  area:               string;
  status:             string;
  deployment_url:     string | null;
  smoke_tests_passed: boolean | null;
  veto_expires_at:    string | null;
  completed_at:       string | null;
  rolled_back_at:     string | null;
  created_at:         string;
}

interface UpcomingItem {
  day:    number;
  title:  string;
  portal: string;
  area:   string;
}

interface ImprovementsData {
  today:     LogRow | null;
  history:   LogRow[];
  upcoming:  UpcomingItem[];
  completed: number;
  total:     number;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  building:    { label: "Building",    className: "bg-amber-50 text-amber-600" },
  live:        { label: "Live",        className: "bg-leaf/10 text-leaf" },
  completed:   { label: "Confirmed",   className: "bg-green-50 text-green-700" },
  rolled_back: { label: "Rolled back", className: "bg-red-50 text-red-500" },
  failed:      { label: "Failed",      className: "bg-red-50 text-red-500" },
  skipped:     { label: "Skipped",     className: "bg-pale text-sub" },
};

function StatusBadge({ status }: { status: string }) {
  const { label, className } = STATUS_BADGE[status] ?? { label: status, className: "bg-pale text-sub" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}

function ImprovementsDashboard({ token }: { token: string }) {
  const [data, setData]       = useState<ImprovementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);

  const headers = { "x-admin-token": token };

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/improvements", { headers })
      .then((r) => r.json())
      .then((j) => { if (j.data) setData(j.data); else toast.error(j.error); })
      .catch(() => toast.error("Failed to load improvements"))
      .finally(() => setLoading(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function doAction(action: "rollback" | "skip") {
    if (!data?.today) return;
    setActing(true);
    try {
      const res = await fetch("/api/admin/improvements", {
        method:  "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body:    JSON.stringify({ action, log_id: data.today.id }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Action failed"); return; }
      toast.success(action === "rollback" ? "Rolled back successfully" : "Day skipped");
      load();
    } catch { toast.error("Action failed"); }
    finally { setActing(false); }
  }

  const vetoOpen = data?.today?.status === "live"
    && data.today.veto_expires_at
    && new Date(data.today.veto_expires_at) > new Date();

  const pct = data ? Math.round((data.completed / data.total) * 100) : 0;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Link href="/admin" className="text-sub hover:text-text mt-1 flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-forest">Improvement Engine</h1>
            <p className="text-sm text-sub mt-0.5">30-day autonomous product improvement</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-pale rounded-full px-4 py-2">
          <TrendingUp className="w-4 h-4 text-leaf" />
          <span className="text-sm font-bold text-forest">Day {data?.completed ?? 0} of {data?.total ?? 30}</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-sub mb-1.5">
          <span>{data?.completed ?? 0} improvements shipped</span>
          <span>{pct}% complete</span>
        </div>
        <div className="h-2.5 bg-pale rounded-full overflow-hidden">
          <div
            className="h-full bg-leaf rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {data?.today && (
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-sub font-mono-green uppercase tracking-widest mb-1">
                Day {data.today.day} — Today
              </p>
              <p className="font-semibold text-text text-base">{data.today.title}</p>
              <p className="text-xs text-sub mt-0.5 capitalize">{data.today.portal} · {data.today.area}</p>
            </div>
            <StatusBadge status={data.today.status} />
          </div>

          {data.today.smoke_tests_passed && (
            <div className="flex items-center gap-1.5 text-xs text-leaf mb-3">
              <CheckCircle className="w-3.5 h-3.5" />
              Smoke tests passed (5/5)
            </div>
          )}

          {data.today.deployment_url && (
            <a
              href={data.today.deployment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-leaf underline mb-3"
            >
              <ExternalLink className="w-3 h-3" />
              greenrides.co.in
            </a>
          )}

          {vetoOpen && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <AlertCircle className="w-4 h-4" />
                Veto window open until{" "}
                {new Date(data.today.veto_expires_at!).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
                })}{" "}
                IST
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => doAction("skip")}
                  disabled={acting}
                  className="flex items-center gap-1 text-xs text-sub border border-border px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
                >
                  <SkipForward className="w-3 h-3" /> Skip
                </button>
                <button
                  onClick={() => doAction("rollback")}
                  disabled={acting}
                  className="flex items-center gap-1 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
                >
                  {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Rollback
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(data?.history ?? []).length > 1 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-text text-sm">History</h2>
          </div>
          {(data?.history ?? []).slice(1).map((row) => (
            <div key={row.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0">
              <span className="text-xs font-mono-green text-sub w-10 flex-shrink-0">D{row.day}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{row.title}</p>
                <p className="text-[10px] text-sub capitalize">{row.portal} · {fmt(row.created_at)}</p>
              </div>
              <StatusBadge status={row.status} />
              {row.deployment_url && (
                <a href={row.deployment_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 text-sub hover:text-leaf" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {(data?.upcoming ?? []).length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-text text-sm">Upcoming</h2>
          </div>
          {(data?.upcoming ?? []).map((item) => (
            <div key={item.day} className="flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0">
              <span className="text-xs font-mono-green text-sub w-10 flex-shrink-0">D{item.day}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{item.title}</p>
                <p className="text-[10px] text-sub capitalize">{item.portal} · {item.area}</p>
              </div>
              <span className="text-[10px] text-sub bg-pale px-2 py-0.5 rounded-full">Pending</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ImprovementsPage() {
  return <AdminGate>{(token: string) => <ImprovementsDashboard token={token} />}</AdminGate>;
}
