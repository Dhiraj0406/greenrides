"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Camera, X, CheckCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Step = "details" | "photos";

export default function NewVehiclePage() {
  const router = useRouter();

  const [step,      setStep]      = useState<Step>("details");
  const [form,      setForm]      = useState({ make: "", model_name: "", number: "", seats: "4" });
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [token,     setToken]     = useState<string | null>(null);
  const [photos,    setPhotos]    = useState<string[]>([]);
  const [previews,  setPreviews]  = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const inputClass = "w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30";

  async function handleCreate() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaving(false); toast.error("Not authenticated"); return; }
      setToken(session.access_token);

      const res = await fetch("/api/fleet/vehicles", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ ...form, seats: parseInt(form.seats, 10) }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to create vehicle"); return; }
      setVehicleId(j.data.id);
      setStep("photos");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !vehicleId) return;

    const remaining = 5 - photos.length;
    const toUpload  = files.slice(0, remaining);

    setUploading(true);
    try {
      // Always fetch a fresh token — stored token may have expired
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session expired. Please refresh."); return; }
      const freshToken = session.access_token;

      for (const file of toUpload) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/fleet/vehicles/${vehicleId}/photos`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${freshToken}` },
          body:    fd,
        });
        const j = await res.json();
        if (j.error) { toast.error(j.error); continue; }
        setPhotos(j.data.photos);
        setPreviews((prev) => [...prev, URL.createObjectURL(file)]);
      }
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemovePhoto(index: number) {
    if (!vehicleId || deleting.has(index)) return;
    setDeleting((prev) => { const s = new Set(prev); s.add(index); return s; });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session expired. Please refresh."); return; }
      const res = await fetch(`/api/fleet/vehicles/${vehicleId}/photos`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ path: photos[index] }),
      });
      const j = await res.json();
      if (j.error) { toast.error(j.error); return; }
      setPhotos(j.data.photos);
      setPreviews((prev) => prev.filter((_, i) => i !== index));
    } catch {
      toast.error("Failed to remove photo. Please try again.");
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(index); return s; });
    }
  }

  if (step === "photos") {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle className="w-5 h-5 text-leaf" />
          <h2 className="font-display text-xl text-forest">Vehicle Added</h2>
        </div>
        <p className="text-sm text-sub mb-6">Add up to 5 photos for admin reference (optional)</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => handleRemovePhoto(i)}
                disabled={deleting.has(i)}
                className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-black/60 rounded-bl-xl rounded-tr-xl disabled:opacity-50"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}

          {photos.length < 5 && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-sub hover:border-leaf hover:text-leaf transition-colors"
            >
              {uploading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <><Camera className="w-5 h-5" /><span className="text-xs">Add</span></>}
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handlePhotoSelect}
        />

        <p className="text-xs text-sub mb-6 text-center">{photos.length}/5 photos · JPEG, PNG, WebP · max 10 MB each</p>

        <button onClick={() => router.replace("/fleet/vehicles")}
          className="w-full bg-leaf text-white font-semibold py-3 rounded-xl">
          Done →
        </button>
        <button onClick={() => router.replace("/fleet/vehicles")}
          className="w-full mt-2 text-sm text-sub py-2">
          Skip for now
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <Link href="/fleet/vehicles" className="text-sub hover:text-text">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="font-display text-xl text-forest">Add Vehicle</h2>
          <p className="text-xs text-sub">Step 1 of 2 · Vehicle details</p>
        </div>
      </div>

      <div className="space-y-3">
        <input type="text" placeholder="Make (e.g. Toyota)"
          value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })}
          className={inputClass} />
        <input type="text" placeholder="Model (e.g. Innova Crysta)"
          value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })}
          className={inputClass} />
        <input type="text" placeholder="Number plate (e.g. OD13AB1234)"
          value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value.toUpperCase() })}
          className={inputClass} />
        <div>
          <label className="block text-xs text-sub mb-1">Seats</label>
          <select value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })}
            className={inputClass}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCreate}
          disabled={saving || !form.make.trim() || !form.model_name.trim() || !form.number.trim()}
          className="w-full bg-leaf text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Next: Add Photos →"}
        </button>
      </div>
    </div>
  );
}
