"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Check, X } from "lucide-react";

interface FareRow {
  id:           string;
  from_city:    string;
  to_city:      string;
  distance_km:  number;
  base_fare:    number;
  discount_pct: number;
  is_active:    boolean;
}

export function FareTable() {
  const [rows, setRows]       = useState<FareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editFare, setEditFare] = useState("");
  const [editDisc, setEditDisc] = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    fetch("/api/fares")
      .then((r) => r.json())
      .then((j) => setRows(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function saveEdit(row: FareRow) {
    setSaving(true);
    try {
      const res = await fetch("/api/fares", {
        method:  "PUT",
        headers: {
          "Content-Type":  "application/json",
          "x-admin-token": sessionStorage.getItem("green_admin_token") ?? "",
        },
        body: JSON.stringify({
          route_id:     row.id,
          base_fare:    parseInt(editFare) * 100,
          discount_pct: parseInt(editDisc) || 0,
        }),
      });
      const json = await res.json();
      if (!json.error) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, base_fare: parseInt(editFare) * 100, discount_pct: parseInt(editDisc) || 0 }
              : r
          )
        );
        setEditId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-leaf" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const isEditing = editId === row.id;
        return (
          <div
            key={row.id}
            className="bg-white border border-border rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text">
                {row.from_city} → {row.to_city}
              </span>
              <span className="text-xs text-sub font-mono-green">
                {row.distance_km} km
              </span>
            </div>

            {isEditing ? (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <label className="text-[10px] text-sub">Fare (₹)</label>
                  <input
                    type="number"
                    value={editFare}
                    onChange={(e) => setEditFare(e.target.value)}
                    className="w-full bg-warm rounded-lg px-2 py-1.5 text-sm text-text outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-sub">Disc %</label>
                  <input
                    type="number"
                    value={editDisc}
                    onChange={(e) => setEditDisc(e.target.value)}
                    className="w-full bg-warm rounded-lg px-2 py-1.5 text-sm text-text outline-none"
                  />
                </div>
                <button
                  onClick={() => saveEdit(row)}
                  disabled={saving}
                  className="mt-3.5 p-2 bg-leaf text-white rounded-lg"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="mt-3.5 p-2 bg-warm text-sub rounded-lg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-sub font-mono-green">
                  <span className="text-forest font-bold text-base">
                    ₹{Math.round(row.base_fare / 100)}
                  </span>
                  {row.discount_pct > 0 && (
                    <span className="bg-gold/10 text-gold px-2 py-0.5 rounded-full font-semibold">
                      {row.discount_pct}% OFF
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditId(row.id);
                    setEditFare(String(Math.round(row.base_fare / 100)));
                    setEditDisc(String(row.discount_pct));
                  }}
                  className="p-2 bg-pale text-leaf rounded-xl"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
