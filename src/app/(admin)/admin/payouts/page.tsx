"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Wallet, Plus, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface AdminPayout {
  id: string; amount_paise: number; period_from: string; period_to: string;
  status: "PENDING" | "PAID"; paid_at: string | null;
  owner: { name: string; phone: string };
}
interface AdminOwnerBasic { id: string; name: string; phone: string }

function PayoutsContent({ token }: { token: string }) {
  const [payouts, setPayouts]     = useState<AdminPayout[]>([]);
  const [owners, setOwners]       = useState<AdminOwnerBasic[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [creating, setCreating]   = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [form, setForm]           = useState({
    owner_id: "", amount: "", period_from: "", period_to: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/payouts", { headers: { "x-admin-token": token } }).then((r) => r.json()),
      fetch("/api/admin/owners",  { headers: { "x-admin-token": token } }).then((r) => r.json()),
    ])
      .then(([payoutsRes, ownersRes]) => {
        setPayouts(payoutsRes.data ?? []);
        setOwners(ownersRes.data ?? []);
      })
      .catch(() => toast.error("Failed to load payouts"))
      .finally(() => setLoading(false));
  }, [token]);

  async function createPayout() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/payouts", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({
          owner_id:     form.owner_id,
          amount_paise: Math.round(parseFloat(form.amount) * 100),
          period_from:  new Date(form.period_from).toISOString(),
          period_to:    new Date(form.period_to).toISOString(),
        }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to create"); return; }
      setPayouts((prev) => [j.data, ...prev]);
      setShowForm(false);
      setForm({ owner_id: "", amount: "", period_from: "", period_to: "" });
      toast.success("Payout created");
    } catch { toast.error("Network error"); }
    finally { setCreating(false); }
  }

  async function markPaid(id: string) {
    setMarkingPaid(id);
    try {
      const res = await fetch(`/api/admin/payouts/${id}`, {
        method:  "PATCH",
        headers: { "x-admin-token": token },
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to mark paid"); return; }
      setPayouts((prev) => prev.map((p) => p.id === id ? { ...p, status: "PAID", paid_at: new Date().toISOString() } : p));
      toast.success("Marked as paid");
    } catch { toast.error("Network error"); }
    finally { setMarkingPaid(null); }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const inputClass = "w-full border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-leaf/30";

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 -ml-1 flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Green Admin</p>
              <h1 className="font-display text-2xl text-white">Payouts</h1>
            </div>
            <button onClick={() => setShowForm((v) => !v)}
              className="bg-leaf/20 text-lime text-xs font-semibold px-3 py-1.5 rounded-full border border-lime/30 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>
        </div>
      </header>
      <div className="px-4 mt-6">
        {showForm && (
          <div className="bg-white border border-border rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-sm font-semibold text-text">New Payout</p>
            <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
              className={inputClass}>
              <option value="" disabled>Select owner…</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <input type="number" placeholder="Amount (₹)" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-sub">From</label>
                <input type="date" value={form.period_from}
                  onChange={(e) => setForm({ ...form, period_from: e.target.value })} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-sub">To</label>
                <input type="date" value={form.period_to}
                  onChange={(e) => setForm({ ...form, period_to: e.target.value })} className={inputClass} />
              </div>
            </div>
            <button onClick={createPayout}
              disabled={creating || !form.owner_id || !form.amount || !form.period_from || !form.period_to}
              className="w-full bg-leaf text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Payout"}
            </button>
          </div>
        )}

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
        {!loading && payouts.length === 0 && !showForm && (
          <p className="text-center text-sub text-sm py-12">No payouts yet.</p>
        )}
        {payouts.map((p) => (
          <div key={p.id} className="bg-white border border-border rounded-2xl p-4 mb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-pale flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 text-sub" />
                </div>
                <div>
                  <p className="font-semibold text-text text-sm">₹{Math.round(p.amount_paise / 100)}</p>
                  <p className="text-xs text-sub">{p.owner.name}</p>
                  <p className="text-xs text-sub">{fmt(p.period_from)} – {fmt(p.period_to)}</p>
                  {p.paid_at && <p className="text-[10px] text-sub/60">Paid {fmt(p.paid_at)}</p>}
                </div>
              </div>
              {p.status === "PENDING" ? (
                <button onClick={() => markPaid(p.id)} disabled={markingPaid === p.id}
                  className="flex items-center gap-1 text-xs font-semibold text-leaf border border-leaf/30 px-2.5 py-1.5 rounded-lg disabled:opacity-60">
                  {markingPaid === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Mark Paid
                </button>
              ) : (
                <span className="text-xs font-semibold text-leaf bg-leaf/10 px-2 py-0.5 rounded-full">Paid</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PayoutsPage() {
  return <AdminGate>{(token) => <PayoutsContent token={token} />}</AdminGate>;
}
