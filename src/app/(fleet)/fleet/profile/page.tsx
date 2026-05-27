"use client";

import { useEffect, useState } from "react";
import { Loader2, User, Phone, Car, Hash } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface DriverProfileData {
  license_number: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  vehicle_model: string | null;
  is_approved: boolean;
  user: { name: string | null; phone: string };
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-full bg-pale flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-leaf" />
      </div>
      <div>
        <p className="text-xs text-sub">{label}</p>
        <p className="text-sm font-semibold text-text">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<DriverProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/fleet/driver/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { setProfile(j.data ?? null); setLoading(false); });
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/register";
  }

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">My Profile</h2>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && profile && (
        <>
          <div className="flex items-center gap-4 bg-white border border-border rounded-2xl p-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-leaf/10 flex items-center justify-center">
              <User className="w-7 h-7 text-leaf" />
            </div>
            <div>
              <p className="font-semibold text-text">{profile.user.name ?? "Driver"}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${profile.is_approved ? "bg-leaf/10 text-leaf" : "bg-gold/10 text-gold"}`}>
                {profile.is_approved ? "Approved" : "Pending"}
              </span>
            </div>
          </div>

          <div className="bg-white border border-border rounded-2xl px-4 mb-4">
            <Row icon={Phone} label="Phone" value={`+91 ${profile.user.phone}`} />
            <Row icon={Hash}  label="License Number" value={profile.license_number} />
            <Row icon={Car}   label="Vehicle Type" value={profile.vehicle_type} />
            <Row icon={Car}   label="Vehicle Number" value={profile.vehicle_number} />
            <Row icon={Car}   label="Vehicle Model" value={profile.vehicle_model} />
          </div>

          <button onClick={signOut}
            className="w-full py-3 rounded-xl text-sm font-semibold text-red-500 border border-red-200 bg-red-50">
            Sign Out
          </button>
        </>
      )}
      {!loading && !profile && (
        <p className="text-center text-sub text-sm py-12">Profile not found.</p>
      )}
    </div>
  );
}
