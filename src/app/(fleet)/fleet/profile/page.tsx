"use client";

import { useEffect, useState } from "react";
import { Loader2, Car, Star, MapPin, LogOut, Pencil, Check, X, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DriverProfile {
  name:           string | null;
  phone:          string;
  vehicle_type:   string | null;
  vehicle_number: string | null;
  vehicle_model:  string | null;
  license_number: string | null;
  avg_rating:     number;
  total_trips:    number;
  is_online:      boolean;
}

const VEHICLE_TYPES = ["Sedan", "SUV", "Hatchback", "MUV", "Traveller"];

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken]         = useState("");
  const [profile, setProfile]     = useState<DriverProfile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState(false);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [ownerRequest, setOwnerRequest] = useState<{ status: "PENDING" | "APPROVED" | "DECLINED" } | null | undefined>(undefined);
  const [isOwner, setIsOwner] = useState(false);
  const [form, setForm] = useState({
    name: "", vehicle_type: "", vehicle_number: "", vehicle_model: "", license_number: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      const t = session.access_token;
      setToken(t);

      // Check if already owner
      const roles: string[] = (session.user.app_metadata?.roles as string[]) ?? [];
      setIsOwner(roles.includes("owner"));

      // Fetch owner request status (only needed if not already an owner)
      if (!roles.includes("owner")) {
        fetch("/api/fleet/owner-request", { headers: { Authorization: `Bearer ${t}` } })
          .then((r) => r.json())
          .then((j) => setOwnerRequest(j.data ?? null))
          .catch(() => setOwnerRequest(null));
      }

      fetch("/api/fleet/driver/profile", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.json())
        .then((j) => {
          if (j.data) {
            setProfile(j.data);
            setForm({
              name:           j.data.name           ?? "",
              vehicle_type:   j.data.vehicle_type   ?? "",
              vehicle_number: j.data.vehicle_number ?? "",
              vehicle_model:  j.data.vehicle_model  ?? "",
              license_number: j.data.license_number ?? "",
            });
          }
        })
        .catch(() => toast.error("Failed to load profile"))
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  async function handleToggle() {
    if (!profile || !token) return;
    setToggling(true);
    const next = !profile.is_online;
    try {
      const res = await fetch("/api/fleet/availability", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ is_online: next }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to update status"); return; }
      setProfile((p) => p ? { ...p, is_online: next } : p);
      toast.success(next ? "You are now online" : "You are now offline");
    } catch { toast.error("Network error"); }
    finally { setToggling(false); }
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/fleet/driver/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to save"); return; }
      setProfile((p) => p ? { ...p, ...form } : p);
      setEditing(false);
      toast.success("Profile updated");
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/fleet/login");
  }

  const initial = profile?.name ? profile.name.charAt(0).toUpperCase() : "D";

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-forest">My Profile</h2>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-sub font-medium">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-leaf" />
        </div>
      )}

      {!loading && !profile && (
        <p className="text-center text-sub text-sm py-12">Profile not found.</p>
      )}

      {!loading && profile && (
        <>
          {/* ── Avatar + identity ─────────────────────────── */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full bg-leaf flex items-center justify-center mb-3">
              <span className="font-display text-3xl text-white">{initial}</span>
            </div>
            <p className="font-display text-xl text-forest">{profile.name ?? "Driver"}</p>
            <p className="text-sm text-sub mt-0.5">+91 {profile.phone}</p>
          </div>

          {/* ── Stats row ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
              <Star className="w-5 h-5 text-gold flex-shrink-0" />
              <div>
                <p className="text-xs text-sub">Rating</p>
                <p className="text-lg font-bold text-text">
                  {profile.avg_rating > 0 ? profile.avg_rating.toFixed(1) : "—"}
                </p>
              </div>
            </div>
            <div className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-leaf flex-shrink-0" />
              <div>
                <p className="text-xs text-sub">Trips</p>
                <p className="text-lg font-bold text-text">{profile.total_trips}</p>
              </div>
            </div>
          </div>

          {/* ── Vehicle / profile info ────────────────────── */}
          <div className="bg-white border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text">Vehicle & Licence</p>
              {!editing ? (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs text-leaf font-semibold">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(false)}
                    className="text-xs text-sub font-medium flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1 text-xs text-leaf font-semibold disabled:opacity-60">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Name",           profile.name],
                  ["Licence No.",    profile.license_number],
                  ["Vehicle Type",   profile.vehicle_type],
                  ["Reg. Number",    profile.vehicle_number],
                  ["Vehicle Model",  profile.vehicle_model],
                ].map(([label, value]) => (
                  <div key={label} className="bg-pale rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-sub mb-0.5">{label}</p>
                    <p className="text-xs font-semibold text-text truncate">{value || "—"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <input type="text" placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-leaf/30" />
                <input type="text" placeholder="Licence number"
                  value={form.license_number}
                  onChange={(e) => setForm({ ...form, license_number: e.target.value.toUpperCase() })}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-leaf/30 font-mono" />
                <select value={form.vehicle_type}
                  onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 ring-leaf/30">
                  <option value="">Vehicle type</option>
                  {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" placeholder="Reg. number (e.g. OD05AB1234)"
                  value={form.vehicle_number}
                  onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-leaf/30 font-mono" />
                <input type="text" placeholder="Vehicle model (e.g. Maruti Swift Dzire)"
                  value={form.vehicle_model}
                  onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-leaf/30" />
              </div>
            )}
          </div>

          {/* ── Online toggle ─────────────────────────────── */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-3 transition-colors border
              ${profile.is_online
                ? "bg-leaf/10 border-leaf text-leaf"
                : "bg-pale border-border text-sub"}`}
          >
            {toggling ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span className={`w-5 h-5 rounded-full flex-shrink-0 transition-colors ${profile.is_online ? "bg-leaf" : "bg-sub/30"}`} />
                <Car className="w-4 h-4" />
                {profile.is_online ? "You're Online — tap to go offline" : "You're Offline — tap to go online"}
              </>
            )}
          </button>

          {/* ── Owner upgrade card ───────────────────────────── */}
          {!isOwner && ownerRequest !== undefined && (
            <div className="mt-4">
              {ownerRequest === null && (
                <div className="bg-pale border border-leaf rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-leaf flex-shrink-0" />
                    <p className="text-sm font-semibold text-forest">Own a fleet?</p>
                  </div>
                  <p className="text-xs text-sub mb-3">
                    Own 2+ vehicles? Apply to manage them on Green Rides.
                  </p>
                  <Link
                    href="/fleet/owner-request"
                    className="inline-block bg-leaf text-white text-xs font-semibold px-4 py-2 rounded-xl"
                  >
                    Apply for Owner Access →
                  </Link>
                </div>
              )}

              {ownerRequest?.status === "PENDING" && (
                <div className="bg-amber-50 border border-amber-400 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <p className="text-sm font-semibold text-text">Owner request pending</p>
                  </div>
                  <p className="text-xs text-sub">
                    Your application is under review. We&apos;ll notify you once approved.
                  </p>
                </div>
              )}

              {ownerRequest?.status === "DECLINED" && (
                <div className="bg-red-50 border border-red-300 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-text mb-1">Request not approved</p>
                  <p className="text-xs text-sub mb-3">
                    You can reapply with updated details.
                  </p>
                  <Link
                    href="/fleet/owner-request"
                    className="inline-block bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                  >
                    Reapply →
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
