"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronLeft, Percent, Check, X, Users } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { toast } from "sonner";

interface DriverCommission {
  id:             string;
  commission_pct: number;
  vehicle_model:  string;
  vehicle_number: string;
  user:           { name: string | null; phone: string };
}

function CommissionContent({ token }: { token: string }) {
  const [drivers, setDrivers] = useState<DriverCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch("/api/admin/commission", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setDrivers(j.data ?? []))
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  function startEdit(driver: DriverCommission) {
    setEditing(driver.id);
    setEditVal(String(driver.commission_pct));
  }

  async function saveEdit(driverId: string) {
    const pct = parseFloat(editVal);
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error("Enter a value between 0 and 100"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/commission", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ driver_profile_id: driverId, commission_pct: pct }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed"); return; }
      setDrivers((prev) => prev.map((d) => d.id === driverId ? { ...d, commission_pct: pct } : d));
      toast.success("Commission updated");
      setEditing(null);
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Green Admin</p>
            <h1 className="font-display text-2xl text-white">Commission Rates</h1>
            <p className="text-lime/60 text-sm mt-0.5">Per-driver platform fee %</p>
          </div>
        </div>
      </header>

      <div className="px-4 mt-4">
        <div className="bg-forest/5 border border-forest/10 rounded-2xl px-4 py-3 mb-4">
          <p className="text-xs text-sub">
            Commission % is the platform&apos;s cut from each fare. Default is <span className="font-semibold text-forest">10%</span>.
            Changes take effect on the next trip completion. All changes are logged.
          </p>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}

        {!loading && drivers.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-sub/30 mx-auto mb-3" />
            <p className="text-sub text-sm">No approved drivers yet.</p>
          </div>
        )}

        {drivers.map((d) => (
          <div key={d.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-text text-sm">{d.user.name ?? "—"}</p>
                <p className="text-xs text-sub">+91 {d.user.phone}</p>
                <p className="text-xs text-sub font-mono-green">{d.vehicle_model} · {d.vehicle_number}</p>
              </div>

              {editing === d.id ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-border rounded-xl overflow-hidden">
                    <input
                      type="text" inputMode="decimal"
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      className="w-16 px-2 py-1.5 text-sm text-center outline-none"
                      autoFocus
                    />
                    <span className="px-2 text-sub text-sm border-l border-border bg-pale">%</span>
                  </div>
                  <button onClick={() => saveEdit(d.id)} disabled={saving}
                    className="w-8 h-8 bg-leaf text-white rounded-lg flex items-center justify-center disabled:opacity-60">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="w-8 h-8 bg-pale text-sub rounded-lg flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => startEdit(d)}
                  className="flex items-center gap-1 bg-pale px-3 py-2 rounded-xl hover:bg-border transition-colors">
                  <span className="font-display text-2xl text-forest">{d.commission_pct}</span>
                  <div className="flex flex-col items-center">
                    <Percent className="w-3 h-3 text-leaf" />
                    <span className="text-[9px] text-sub leading-none mt-0.5">tap</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CommissionPage() {
  return <AdminGate>{(token) => <CommissionContent token={token} />}</AdminGate>;
}
