"use client";

import { useEffect, useState } from "react";
import { Loader2, Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface FleetNotif {
  id: string; type: string; title: string; body: string;
  read: boolean; created_at: string;
}

export default function NotificationsPage() {
  const [notifs, setNotifs]   = useState<FleetNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      setToken(session.access_token);
      fetch("/api/fleet/notifications", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => { if (j.error) { toast.error(j.error); } else { setNotifs(j.data?.notifications ?? []); } })
        .catch(() => toast.error("Failed to load notifications"))
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  const [marking, setMarking] = useState(false);

  async function markAllRead() {
    if (!token || marking) return;
    const unreadIds = notifs.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setMarking(true);
    try {
      const res = await fetch("/api/fleet/notifications", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ ids: unreadIds }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to mark read"); return; }
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { toast.error("Network error"); }
    finally { setMarking(false); }
  }

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-forest">Alerts</h2>
        {unreadCount > 0 && (
          <button onClick={markAllRead} disabled={marking}
            className="flex items-center gap-1 text-xs text-leaf font-semibold disabled:opacity-50">
            {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Mark all read
          </button>
        )}
      </div>
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
      {!loading && notifs.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Bell className="w-8 h-8 text-sub" />
          <p className="text-center text-sub text-sm">No notifications yet.</p>
        </div>
      )}
      {notifs.map((n) => (
        <div key={n.id}
          className={`rounded-2xl p-4 mb-2 border transition-colors ${n.read ? "bg-white border-border" : "bg-leaf/5 border-leaf/20"}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-text">{n.title}</p>
            {!n.read && <span className="w-2 h-2 rounded-full bg-leaf flex-shrink-0 mt-1.5" />}
          </div>
          <p className="text-xs text-sub mt-0.5">{n.body}</p>
          <p className="text-[10px] text-sub/60 mt-1">
            {new Date(n.created_at).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
      ))}
    </div>
  );
}
