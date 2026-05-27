"use client";

import { useEffect, useState } from "react";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function AvailabilityPage() {
  const [online, setOnline]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [token, setToken]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      fetch("/api/fleet/driver/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { setOnline(j.data?.is_online ?? false); setLoading(false); });
    });
  }, []);

  async function toggle() {
    if (!token) return;
    setSaving(true);
    const res = await fetch("/api/fleet/availability", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ is_online: !online }),
    });
    const j = await res.json();
    setSaving(false);
    if (j.error) { toast.error(j.error); return; }
    setOnline(!online);
    toast.success(online ? "You are now offline" : "You are now online");
  }

  return (
    <div className="px-4 py-6 flex flex-col items-center">
      <h2 className="font-display text-xl text-forest mb-8 self-start">Availability</h2>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-leaf mt-12" />
      ) : (
        <>
          <div className={`w-40 h-40 rounded-full flex items-center justify-center mb-6 transition-colors
            ${online ? "bg-leaf/10" : "bg-pale"}`}>
            {online
              ? <Wifi className="w-16 h-16 text-leaf" />
              : <WifiOff className="w-16 h-16 text-sub" />}
          </div>
          <p className="text-lg font-semibold text-text mb-1">
            {online ? "You are Online" : "You are Offline"}
          </p>
          <p className="text-xs text-sub mb-8 text-center max-w-xs">
            {online
              ? "Riders can see and book your rides. Toggle off when you're done for the day."
              : "You won't receive new ride assignments. Toggle on to start accepting bookings."}
          </p>
          <button
            onClick={toggle}
            disabled={saving}
            className={`w-full max-w-xs py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors
              ${online
                ? "bg-red-50 text-red-500 border border-red-200"
                : "bg-leaf text-white"}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : online ? "Go Offline" : "Go Online"}
          </button>
        </>
      )}
    </div>
  );
}
