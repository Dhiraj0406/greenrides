"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Loader2, Truck, ChevronDown, ChevronUp, ChevronLeft,
  Plus, X, Trash2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { toast } from "sonner";

interface VehicleRow {
  id:         string;
  make:       string;
  model_name: string;
  number:     string;
  seats:      number;
  active:     boolean;
  photos:     string[];
  owner:      { name: string | null; phone: string } | null;
  driver:     { name: string | null; phone: string } | null;
  created_at: string;
}

interface OwnerOption  { id: string; name: string; phone: string; }
interface DriverOption { id: string; vehicle_model: string; vehicle_number: string; user: { name: string | null; phone: string }; }

const MAKES = ["Toyota", "Maruti", "Hyundai", "Mahindra", "Tata", "Honda", "Kia", "MG", "Force", "Other"];

function AddVehicleModal({ token, onClose, onCreated }: {
  token:     string;
  onClose:   () => void;
  onCreated: () => void;
}) {
  const [owners,  setOwners]  = useState<OwnerOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({
    owner_id: "", make: "", model_name: "", number: "", seats: "4", driver_id: "",
  });

  useEffect(() => {
    const h = { "x-admin-token": token };
    Promise.all([
      fetch("/api/admin/owners",  { headers: h }).then((r) => r.json()),
      fetch("/api/admin/drivers?approved=1", { headers: h }).then((r) => r.json()),
    ])
      .then(([ownersRes, driversRes]) => {
        setOwners((ownersRes.data ?? []).filter((o: { status: string }) => o.status === "ACTIVE"));
        setDrivers(driversRes.data ?? []);
      })
      .catch(() => toast.error("Failed to load options"))
      .finally(() => setLoading(false));
  }, [token]);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.owner_id) { toast.error("Select an owner"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/vehicles", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({
          owner_id:   form.owner_id,
          make:       form.make,
          model_name: form.model_name,
          number:     form.number.toUpperCase(),
          seats:      parseInt(form.seats),
          driver_id:  form.driver_id || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error ?? "Failed"); return; }
      toast.success("Vehicle added");
      onCreated();
      onClose();
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-cream rounded-t-3xl px-4 pt-5 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-forest">Add Vehicle</h2>
          <button onClick={onClose} className="p-1 text-sub hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-leaf" /></div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-sub font-semibold mb-1 block">Owner *</label>
              <select value={form.owner_id} onChange={set("owner_id")} required
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf">
                <option value="">Select owner…</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} (+91 {o.phone})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-sub font-semibold mb-1 block">Make *</label>
                <select value={form.make} onChange={set("make")} required
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf">
                  <option value="">Select…</option>
                  {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-sub font-semibold mb-1 block">Model *</label>
                <input value={form.model_name} onChange={set("model_name")} required
                  placeholder="Innova Crysta"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
              </div>
              <div>
                <label className="text-xs text-sub font-semibold mb-1 block">Reg. Number *</label>
                <input value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value.toUpperCase() }))}
                  required placeholder="OD02AB1234"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf font-mono uppercase" />
              </div>
              <div>
                <label className="text-xs text-sub font-semibold mb-1 block">Seats *</label>
                <input value={form.seats} onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value.replace(/\D/g, "") }))} required type="text" inputMode="numeric" pattern="[0-9]*"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf" />
              </div>
            </div>

            <div>
              <label className="text-xs text-sub font-semibold mb-1 block">Assign Driver (optional)</label>
              <select value={form.driver_id} onChange={set("driver_id")}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-leaf">
                <option value="">No driver yet</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user.name ?? "—"} · {d.vehicle_number}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[11px] text-sub">Owner can log in at /fleet/login with their phone to manage this vehicle.</p>

            <button type="submit" disabled={saving}
              className="w-full bg-leaf text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Adding…" : "Add Vehicle"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function VehicleCard({ v, token, onUpdate, onRemove }: {
  v:        VehicleRow;
  token:    string;
  onUpdate: (id: string, patch: Partial<VehicleRow>) => void;
  onRemove: (id: string) => void;
}) {
  const [open,      setOpen]      = useState(false);
  const [toggling,  setToggling]  = useState(false);
  const [removing,  setRemoving]  = useState(false);

  async function toggleActive() {
    setToggling(true);
    try {
      const res = await fetch(`/api/admin/vehicles/${v.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ active: !v.active }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed"); return; }
      onUpdate(v.id, { active: !v.active });
      toast.success(v.active ? "Vehicle deactivated" : "Vehicle activated");
    } catch { toast.error("Network error"); }
    finally { setToggling(false); }
  }

  async function removeVehicle() {
    if (!confirm(`Remove ${v.make} ${v.model_name} (${v.number})? This will deactivate it and unlink any assigned driver.`)) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/vehicles/${v.id}`, {
        method:  "DELETE",
        headers: { "x-admin-token": token },
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed"); return; }
      toast.success("Vehicle removed");
      onRemove(v.id);
    } catch { toast.error("Network error"); }
    finally { setRemoving(false); }
  }

  return (
    <div className="bg-white border border-border rounded-2xl mb-3 overflow-hidden">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        {v.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.photos[0]} alt={v.number}
            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-border" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-pale border border-border flex-shrink-0 flex items-center justify-center">
            <Truck className="w-5 h-5 text-sub/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text text-sm">{v.make} {v.model_name}</p>
          <p className="text-xs text-sub">{v.number} · {v.seats} seats</p>
          <p className="text-xs text-sub mt-0.5">{v.owner?.name ?? "—"} · {v.owner?.phone ?? "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.active ? "bg-leaf/10 text-leaf" : "bg-gray-100 text-sub"}`}>
            {v.active ? "Active" : "Inactive"}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-sub mt-1" /> : <ChevronDown className="w-4 h-4 text-sub mt-1" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          {v.driver && (
            <p className="text-xs text-sub mb-3">
              Driver: <span className="font-semibold text-text">{v.driver.name ?? "—"}</span> · {v.driver.phone}
            </p>
          )}

          {v.photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {v.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-xl border border-border" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-sub italic mb-3">No photos uploaded</p>
          )}

          <div className="flex gap-2">
            <button onClick={toggleActive} disabled={toggling}
              className="flex items-center gap-1.5 flex-1 border border-border rounded-xl py-2 text-xs font-semibold text-text justify-center disabled:opacity-60">
              {toggling
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : v.active
                  ? <ToggleRight className="w-4 h-4 text-leaf" />
                  : <ToggleLeft  className="w-4 h-4 text-sub" />}
              {v.active ? "Deactivate" : "Activate"}
            </button>
            <button onClick={removeVehicle} disabled={removing}
              className="flex items-center gap-1.5 px-4 border border-red-200 bg-red-50 text-red-500 rounded-xl py-2 text-xs font-semibold justify-center disabled:opacity-60">
              {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VehiclesContent({ token }: { token: string }) {
  const [vehicles,  setVehicles]  = useState<VehicleRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/vehicles", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setVehicles(j.data ?? []))
      .catch(() => toast.error("Failed to load vehicles"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function handleUpdate(id: string, patch: Partial<VehicleRow>) {
    setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, ...patch } : v));
  }

  function handleRemove(id: string) {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }

  const activeCount = vehicles.filter((v) => v.active).length;

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6 sticky top-0 z-10">
        <div className="pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-lime/70 -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-lime/60 text-xs font-mono uppercase tracking-widest mb-1">Green Admin</p>
              <h1 className="font-display text-2xl text-white">Vehicles</h1>
              <p className="text-lime/60 text-sm mt-0.5">{activeCount} active · {vehicles.length} total</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-lime text-forest text-xs font-bold px-3 py-1.5 rounded-full">
            <Plus className="w-3.5 h-3.5" /> Add Vehicle
          </button>
        </div>
      </header>

      <div className="px-4 mt-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}
        {!loading && vehicles.length === 0 && (
          <div className="text-center py-16">
            <Truck className="w-10 h-10 text-sub/30 mx-auto mb-3" />
            <p className="text-sub text-sm">No vehicles yet.</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-3 text-leaf text-sm font-semibold underline">
              Add the first vehicle
            </button>
          </div>
        )}
        {!loading && vehicles.map((v) => (
          <VehicleCard key={v.id} v={v} token={token} onUpdate={handleUpdate} onRemove={handleRemove} />
        ))}
      </div>

      {showAdd && (
        <AddVehicleModal token={token} onClose={() => setShowAdd(false)} onCreated={load} />
      )}
    </div>
  );
}

export default function AdminVehiclesPage() {
  return <AdminGate>{(token) => <VehiclesContent token={token} />}</AdminGate>;
}
