"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Star, ChevronLeft, Phone, CheckCircle, XCircle, Plus, X } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Driver {
  id:             string;
  is_approved:    boolean;
  is_online:      boolean;
  vehicle_type:   string;
  vehicle_number: string;
  vehicle_model:  string;
  license_number: string;
  avg_rating:     number;
  total_trips:    number;
  user: { name: string | null; phone: string };
}

const VEHICLE_TYPES = ["SUV", "Sedan", "Hatchback", "MUV", "Van", "Traveller"];

function AddDriverModal({ token, onClose, onCreated }: {
  token:     string;
  onClose:   () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({
    name: "", phone: "", license_number: "",
    vehicle_type: "", vehicle_number: "", vehicle_model: "",
  });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/drivers", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
      toast.success("Driver added and approved");
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-cream rounded-t-3xl px-4 pt-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-forest">Add Driver</h2>
          <button onClick={onClose} className="p-1 text-sub hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-sub font-semibold mb-1 block">Full Name</label>
              <input value={form.name} onChange={set("name")} required
                placeholder="Ramesh Kumar"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-sub font-semibold mb-1 block">Phone (10 digits)</label>
              <div className="flex">
                <span className="flex items-center px-3 bg-pale border border-r-0 border-border rounded-l-xl text-sm text-sub">+91</span>
                <input value={form.phone} onChange={set("phone")} required maxLength={10}
                  placeholder="9668021577" type="tel"
                  className="flex-1 border border-border rounded-r-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
              </div>
            </div>
            <div>
              <label className="text-xs text-sub font-semibold mb-1 block">License No.</label>
              <input value={form.license_number} onChange={set("license_number")} required
                placeholder="OD0120240001234"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
            </div>
            <div>
              <label className="text-xs text-sub font-semibold mb-1 block">Vehicle Type</label>
              <select value={form.vehicle_type} onChange={set("vehicle_type")} required
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf">
                <option value="">Select…</option>
                {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-sub font-semibold mb-1 block">Vehicle Model</label>
              <input value={form.vehicle_model} onChange={set("vehicle_model")} required
                placeholder="Innova Crysta"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
            </div>
            <div>
              <label className="text-xs text-sub font-semibold mb-1 block">Vehicle Number</label>
              <input value={form.vehicle_number} onChange={set("vehicle_number")} required
                placeholder="OD02AB1234"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf uppercase" />
            </div>
          </div>
          <p className="text-[11px] text-sub">Driver is auto-approved. They can log in immediately at /fleet/login using their phone number.</p>
          <button type="submit" disabled={saving}
            className="w-full bg-leaf text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Adding…" : "Add Driver"}
          </button>
        </form>
      </div>
    </div>
  );
}

function DriversContent({ token }: { token: string }) {
  const [drivers, setDrivers]   = useState<Driver[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"pending" | "all">("pending");
  const [showAdd, setShowAdd]   = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  function loadDrivers() {
    setLoading(true);
    fetch("/api/admin/drivers", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setDrivers(j.data ?? []))
      .catch(() => toast.error("Failed to load drivers"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadDrivers(); }, [token]);

  async function toggleApproval(id: string, approve: boolean) {
    setToggling(id);
    try {
      const res = await fetch(`/api/admin/drivers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ is_approved: approve }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Action failed"); return; }
      setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, is_approved: approve } : d)));
      toast.success(approve ? "Driver approved" : "Approval revoked");
    } catch { toast.error("Network error"); }
    finally { setToggling(null); }
  }

  const filtered = tab === "pending" ? drivers.filter((d) => !d.is_approved) : drivers;

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4 sticky top-0 z-10">
        <div className="pt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-lime/70 hover:text-lime">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-display text-xl text-white">Drivers</h1>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-leaf text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <Plus className="w-3.5 h-3.5" /> Add Driver
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {(["pending", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                tab === t ? "bg-leaf text-white" : "bg-forest-mid text-lime/60 hover:text-lime"
              )}>
              {t === "pending" ? "Pending Approval" : "All Drivers"}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sub text-sm">
            {tab === "pending" ? "No drivers pending approval" : "No drivers registered yet"}
          </div>
        ) : (
          filtered.map((driver) => (
            <div key={driver.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-text">{driver.user.name ?? "—"}</p>
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        driver.is_online ? "bg-leaf animate-pulse" : "bg-gray-300"
                      )}
                      title={driver.is_online ? "Online" : "Offline"}
                    />
                  </div>
                  <p className="text-xs text-sub">{driver.user.phone}</p>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full",
                  driver.is_approved ? "bg-leaf/10 text-leaf" : "bg-gold/10 text-gold")}>
                  {driver.is_approved ? "Approved" : "Pending"}
                </span>
              </div>
              <p className="text-sm text-text mb-0.5">
                {driver.vehicle_model} · <span className="font-mono-green">{driver.vehicle_number}</span>
              </p>
              <p className="text-xs text-sub mb-3">{driver.vehicle_type} · License: {driver.license_number}</p>
              <div className="flex items-center gap-4 text-xs text-sub font-mono-green mb-3">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-gold text-gold" />
                  {driver.avg_rating.toFixed(1)}
                </span>
                <span>{driver.total_trips} trips</span>
              </div>
              <div className="flex gap-2">
                <a href={`tel:${driver.user.phone}`}
                  className="flex items-center justify-center gap-1.5 flex-1 bg-pale text-leaf text-sm font-semibold py-2.5 rounded-xl">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
                {!driver.is_approved ? (
                  <button onClick={() => toggleApproval(driver.id, true)} disabled={toggling === driver.id}
                    className="flex items-center justify-center gap-1.5 flex-1 bg-leaf text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-60">
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                ) : (
                  <button onClick={() => toggleApproval(driver.id, false)} disabled={toggling === driver.id}
                    className="flex items-center justify-center gap-1.5 flex-1 bg-red-50 text-red-500 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-60">
                    <XCircle className="w-3.5 h-3.5" /> Revoke
                  </button>
                )}
              </div>
              <Link
                href="/admin/drivers/dispatch"
                className="text-xs text-leaf font-semibold mt-2 inline-block"
              >
                View live dispatch →
              </Link>
            </div>
          ))
        )}
      </div>

      {showAdd && (
        <AddDriverModal
          token={token}
          onClose={() => setShowAdd(false)}
          onCreated={loadDrivers}
        />
      )}
    </div>
  );
}

export default function AdminDriversPage() {
  return <AdminGate>{(token) => <DriversContent token={token} />}</AdminGate>;
}
