"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronLeft, Save, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface RouteRow {
  id:        string;
  from_city: string;
  to_city:   string;
  base_fare: number; // paise
  is_active: boolean;
  // editing state (rupees)
  edited:    number;
  dirty:     boolean;
  saving:    boolean;
}

function FaresContent({ token }: { token: string }) {
  const [rows, setRows]     = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/fares", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((j) => {
        if (!j.data) return;
        setRows(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (j.data as any[]).map((r) => ({
            id:        r.id,
            from_city: r.from_city,
            to_city:   r.to_city,
            base_fare: r.base_fare,
            is_active: r.is_active,
            edited:    Math.round(r.base_fare / 100),
            dirty:     false,
            saving:    false,
          }))
        );
      })
      .catch(() => toast.error("Failed to load fares"))
      .finally(() => setLoading(false));
  }, [token]);

  function handleChange(id: string, rupees: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, edited: rupees, dirty: rupees !== Math.round(r.base_fare / 100) }
          : r
      )
    );
  }

  async function handleSave(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row || !row.dirty) return;

    setRows((prev) => prev.map((r) => r.id === id ? { ...r, saving: true } : r));

    const paise = row.edited * 100;
    try {
      const res = await fetch("/api/fares", {
        method:  "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ routes: [{ id, base_fare: paise }] }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Failed to save"); return; }
      toast.success("Fare updated");
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, base_fare: paise, dirty: false } : r));
    } catch { toast.error("Network error"); }
    finally {
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, saving: false } : r));
    }
  }

  const visible = rows.filter(
    (r) =>
      !filter ||
      r.from_city.toLowerCase().includes(filter.toLowerCase()) ||
      r.to_city.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4 sticky top-0 z-10">
        <div className="pt-3 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 hover:text-lime">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-xl text-white">Fare Editor</h1>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by city…"
          className="mt-3 w-full bg-forest-mid border border-leaf/20 rounded-xl px-3 py-2
                     text-sm text-white placeholder:text-lime/40 outline-none focus:border-leaf/60"
        />
      </header>

      <div className="px-4 mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-center py-16 text-sub text-sm">No routes found</p>
        ) : (
          visible.map((row) => (
            <div key={row.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-text mb-3">
                <span>{row.from_city}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sub flex-shrink-0" />
                <span>{row.to_city}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sub text-sm">₹</span>
                <input
                  type="number"
                  value={row.edited}
                  min={100}
                  step={50}
                  onChange={(e) => handleChange(row.id, Number(e.target.value))}
                  className="flex-1 bg-warm border border-border rounded-xl px-3 py-2
                             text-sm text-text font-mono-green outline-none
                             focus:border-leaf focus:ring-1 focus:ring-leaf/30"
                />
                <button
                  onClick={() => handleSave(row.id)}
                  disabled={!row.dirty || row.saving}
                  className="flex items-center gap-1.5 bg-leaf disabled:opacity-40 text-white
                             text-sm font-semibold px-4 py-2 rounded-xl"
                >
                  {row.saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Save className="w-3.5 h-3.5" />
                  }
                  Save
                </button>
              </div>

              {row.dirty && (
                <p className="text-xs text-gold mt-1.5">
                  Was ₹{Math.round(row.base_fare / 100)} · unsaved
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminFaresPage() {
  return <AdminGate>{(token) => <FaresContent token={token} />}</AdminGate>;
}
