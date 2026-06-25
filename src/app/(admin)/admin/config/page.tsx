"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ToggleLeft, ToggleRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

const SCOPE_LABELS: Record<string, string> = {
  RIDESHARING: "Ridesharing",
  RENTALS:     "Rentals",
  USED_CARS:   "Used Cars",
  FINTECH:     "Fintech",
  CARGO:       "Cargo",
  EV_CHARGING: "EV Charging",
  PLATFORM:    "Platform",
};

const FLAG_LABELS: Record<string, string> = {
  "dispatch.telegram_cascade":    "Telegram Cascade Dispatch",
  "dispatch.in_app_accept":       "In-App Accept",
  "payments.razorpay_enabled":    "Razorpay Payments",
  "kyc.require_for_dispatch":     "Require KYC for Dispatch",
};

interface Flag {
  key:          string;
  module_scope: string;
  enabled:      boolean;
  value_json:   Record<string, unknown>;
  updated_at:   string;
}

function ConfigContent({ token }: { token: string }) {
  const [flags, setFlags]     = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/config", { headers: { "x-admin-token": token } });
      const j   = await res.json();
      if (!res.ok) { toast.error(j.error ?? "Failed to load config"); return; }
      setFlags(j.data ?? []);
    } catch {
      toast.error("Failed to load remote config");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(flag: Flag) {
    setToggling(flag.key);
    try {
      const res  = await fetch(`/api/admin/config/${encodeURIComponent(flag.key)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ enabled: !flag.enabled }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Update failed"); return; }
      setFlags((prev) => prev.map((f) => f.key === flag.key ? { ...f, enabled: !f.enabled } : f));
      toast.success(`${FLAG_LABELS[flag.key] ?? flag.key} ${!flag.enabled ? "enabled" : "disabled"}`);
    } catch { toast.error("Network error"); }
    finally {
      setToggling(null);
    }
  }

  const grouped = flags.reduce<Record<string, Flag[]>>((acc, f) => {
    (acc[f.module_scope] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-lime/60 text-xs font-mono uppercase tracking-widest mb-1">Green Admin</p>
            <h1 className="font-display text-2xl text-white">Remote Config</h1>
          </div>
        </div>
      </header>

      <div className="px-4 mt-6">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}

        {!loading && flags.length === 0 && (
          <p className="text-center text-sub text-sm py-12">No flags found.</p>
        )}

        {!loading && Object.entries(grouped).map(([scope, scopeFlags]) => (
          <div key={scope} className="mb-6">
            <p className="text-xs font-semibold text-sub uppercase tracking-wider mb-2">
              {SCOPE_LABELS[scope] ?? scope}
            </p>
            <div className="space-y-2">
              {scopeFlags.map((flag) => (
                <div
                  key={flag.key}
                  className="bg-white border border-border rounded-2xl px-4 py-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-text">
                      {FLAG_LABELS[flag.key] ?? flag.key}
                    </p>
                    <p className="text-xs text-sub font-mono mt-0.5">{flag.key}</p>
                  </div>

                  <button
                    onClick={() => toggle(flag)}
                    disabled={toggling === flag.key}
                    className="flex-shrink-0 disabled:opacity-50"
                    aria-label={flag.enabled ? "Disable" : "Enable"}
                  >
                    {toggling === flag.key ? (
                      <Loader2 className="w-6 h-6 animate-spin text-leaf" />
                    ) : flag.enabled ? (
                      <ToggleRight className="w-8 h-8 text-leaf" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-sub" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConfigPage() {
  return <AdminGate>{(token) => <ConfigContent token={token} />}</AdminGate>;
}
