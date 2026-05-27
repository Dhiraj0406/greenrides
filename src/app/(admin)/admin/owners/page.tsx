"use client";

import { useEffect, useState } from "react";
import { Loader2, Truck, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface AdminOwner {
  id: string; name: string; phone: string; email: string | null;
  status: "ACTIVE" | "SUSPENDED";
  vehicles: { id: string; active: boolean }[];
}

function OwnersContent({ token }: { token: string }) {
  const [owners, setOwners]   = useState<AdminOwner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/owners", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => { setOwners(j.data ?? []); setLoading(false); });
  }, [token]);

  async function toggleStatus(id: string, current: "ACTIVE" | "SUSPENDED") {
    const newStatus = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/admin/owners/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body:    JSON.stringify({ status: newStatus }),
    });
    const j = await res.json();
    if (j.error) { toast.error(j.error); return; }
    setOwners((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
    toast.success(`Owner ${newStatus === "ACTIVE" ? "activated" : "suspended"}`);
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4">
          <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Green Admin</p>
          <h1 className="font-display text-2xl text-white">Fleet Owners</h1>
        </div>
      </header>
      <div className="px-4 mt-6">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
        {!loading && owners.length === 0 && (
          <p className="text-center text-sub text-sm py-12">No owners yet.</p>
        )}
        {owners.map((o) => (
          <div key={o.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-pale flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-sub" />
                </div>
                <div>
                  <p className="font-semibold text-text text-sm">{o.name}</p>
                  <p className="text-xs text-sub">+91 {o.phone}</p>
                  {o.email && <p className="text-xs text-sub">{o.email}</p>}
                  <p className="text-xs text-sub">{o.vehicles.length} vehicle{o.vehicles.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button onClick={() => toggleStatus(o.id, o.status)}>
                  {o.status === "ACTIVE"
                    ? <ToggleRight className="w-7 h-7 text-leaf" />
                    : <ToggleLeft  className="w-7 h-7 text-sub" />}
                </button>
                <span className={`text-[10px] font-semibold ${o.status === "ACTIVE" ? "text-leaf" : "text-red-400"}`}>
                  {o.status === "ACTIVE" ? "Active" : "Suspended"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OwnersPage() {
  return <AdminGate>{(token) => <OwnersContent token={token} />}</AdminGate>;
}
