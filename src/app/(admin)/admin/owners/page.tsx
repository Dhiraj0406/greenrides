"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Truck, ToggleLeft, ToggleRight, ChevronLeft, Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface AdminOwner {
  id: string; name: string; phone: string; email: string | null;
  status: "ACTIVE" | "SUSPENDED";
  vehicles: { id: string; active: boolean }[];
}

function AddOwnerModal({ token, onClose, onCreated }: {
  token:     string;
  onClose:   () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/owners", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ name: form.name, phone: form.phone, email: form.email || null }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error ?? "Failed"); return; }
      toast.success("Owner created — they can log in with their phone at /fleet/login");
      onCreated();
      onClose();
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-cream rounded-t-3xl px-4 pt-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-forest">Add Owner</h2>
          <button onClick={onClose} className="p-1 text-sub hover:text-text"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-sub font-semibold mb-1 block">Full Name *</label>
            <input value={form.name} onChange={set("name")} required placeholder="Rajesh Mohanty"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
          </div>
          <div>
            <label className="text-xs text-sub font-semibold mb-1 block">Phone (10 digits) *</label>
            <div className="flex">
              <span className="flex items-center px-3 bg-pale border border-r-0 border-border rounded-l-xl text-sm text-sub">+91</span>
              <input value={form.phone} onChange={set("phone")} required maxLength={10} type="tel"
                placeholder="9668021577"
                className="flex-1 border border-border rounded-r-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
            </div>
          </div>
          <div>
            <label className="text-xs text-sub font-semibold mb-1 block">Email (optional)</label>
            <input value={form.email} onChange={set("email")} type="email" placeholder="owner@example.com"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
          </div>
          <p className="text-[11px] text-sub">Owner is auto-approved and can log in immediately at /fleet/login using their phone + OTP.</p>
          <button type="submit" disabled={saving}
            className="w-full bg-leaf text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Creating…" : "Create Owner"}
          </button>
        </form>
      </div>
    </div>
  );
}

function OwnersContent({ token }: { token: string }) {
  const [owners,   setOwners]   = useState<AdminOwner[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);

  function loadOwners() {
    setLoading(true);
    fetch("/api/admin/owners", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setOwners(j.data ?? []))
      .catch(() => toast.error("Failed to load owners"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadOwners(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStatus(id: string, current: "ACTIVE" | "SUSPENDED") {
    const newStatus = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setToggling(id);
    try {
      const res = await fetch(`/api/admin/owners/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ status: newStatus }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Action failed"); return; }
      setOwners((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
      toast.success(`Owner ${newStatus === "ACTIVE" ? "activated" : "suspended"}`);
    } catch { toast.error("Network error"); }
    finally { setToggling(null); }
  }

  async function removeOwner(id: string, name: string) {
    if (!confirm(`Remove ${name}? Their owner access will be revoked. Their vehicles remain but they'll lose fleet access.`)) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/admin/owners/${id}`, {
        method:  "DELETE",
        headers: { "x-admin-token": token },
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed"); return; }
      setOwners((prev) => prev.filter((o) => o.id !== id));
      toast.success("Owner removed");
    } catch { toast.error("Network error"); }
    finally { setRemoving(null); }
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6 sticky top-0 z-10">
        <div className="pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-lime/70 -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Green Admin</p>
              <h1 className="font-display text-2xl text-white">Fleet Owners</h1>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-lime text-forest text-xs font-bold px-3 py-1.5 rounded-full">
            <Plus className="w-3.5 h-3.5" /> Add Owner
          </button>
        </div>
      </header>

      <div className="px-4 mt-6">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
        {!loading && owners.length === 0 && (
          <div className="text-center py-16">
            <Truck className="w-10 h-10 text-sub/30 mx-auto mb-3" />
            <p className="text-sub text-sm">No owners yet.</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-leaf text-sm font-semibold underline">
              Add the first owner
            </button>
          </div>
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
                  <p className="text-xs text-sub">{o.vehicles?.length ?? 0} vehicle{(o.vehicles?.length ?? 0) !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleStatus(o.id, o.status)} disabled={toggling === o.id}>
                    {o.status === "ACTIVE"
                      ? <ToggleRight className="w-7 h-7 text-leaf" />
                      : <ToggleLeft  className="w-7 h-7 text-sub" />}
                  </button>
                  <button onClick={() => removeOwner(o.id, o.name)} disabled={removing === o.id}
                    className="p-1 text-red-400 hover:text-red-600 disabled:opacity-40">
                    {removing === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
                <span className={`text-[10px] font-semibold ${o.status === "ACTIVE" ? "text-leaf" : "text-red-400"}`}>
                  {o.status === "ACTIVE" ? "Active" : "Suspended"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddOwnerModal token={token} onClose={() => setShowAdd(false)} onCreated={loadOwners} />
      )}
    </div>
  );
}

export default function OwnersPage() {
  return <AdminGate>{(token) => <OwnersContent token={token} />}</AdminGate>;
}
