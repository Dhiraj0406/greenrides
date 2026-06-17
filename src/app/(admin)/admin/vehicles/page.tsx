"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Truck, ChevronDown, ChevronUp, ChevronLeft } from "lucide-react";
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

function VehicleCard({ v }: { v: VehicleRow }) {
  const [open, setOpen] = useState(false);

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
            <div className="grid grid-cols-3 gap-2">
              {v.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-xl border border-border" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-sub italic">No photos uploaded</p>
          )}
        </div>
      )}
    </div>
  );
}

function VehiclesContent({ token }: { token: string }) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/admin/vehicles", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => { setVehicles(j.data ?? []); })
      .catch(() => toast.error("Failed to load vehicles"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-lime/60 text-xs font-mono uppercase tracking-widest mb-1">Green Admin</p>
            <h1 className="font-display text-2xl text-white">Vehicles</h1>
            <p className="text-lime/60 text-sm mt-1">{vehicles.length} registered</p>
          </div>
        </div>
      </header>

      <div className="px-4 mt-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}
        {!loading && vehicles.length === 0 && (
          <p className="text-center text-sub text-sm py-12">No vehicles registered yet.</p>
        )}
        {!loading && vehicles.map((v) => <VehicleCard key={v.id} v={v} />)}
      </div>
    </div>
  );
}

export default function AdminVehiclesPage() {
  return <AdminGate>{(token) => <VehiclesContent token={token} />}</AdminGate>;
}
