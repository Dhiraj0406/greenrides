// src/components/drivers/DispatchCard.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2, Navigation } from "lucide-react";

interface DispatchRequest {
  id: string;
  request_id: string;
  expires_at: string;
  request: {
    from_city:   string;
    to_city:     string;
    fare_paise:  number;
    travel_date: string;
    notes:       string | null;
  } | null;
}

interface Props {
  driverId: string;
  initial:  DispatchRequest | null;
}

export function DispatchCard({ driverId, initial }: Props) {
  const [dispatch, setDispatch] = useState<DispatchRequest | null>(initial);
  const [secondsLeft, setSeconds] = useState(0);
  const [responding, setResponding] = useState(false);

  // Recalculate seconds remaining
  useEffect(() => {
    if (!dispatch) return;
    const recalc = () => {
      const diff = Math.max(0, Math.round((new Date(dispatch.expires_at).getTime() - Date.now()) / 1000));
      setSeconds(diff);
      if (diff === 0) setDispatch(null);
    };
    recalc();
    const id = setInterval(recalc, 1000);
    return () => clearInterval(id);
  }, [dispatch]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`driver-dispatch-${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "DriverDispatch", filter: `driver_id=eq.${driverId}` },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status === "PENDING") {
            const { data: req } = await supabase
              .from("RideRequest")
              .select("from_city, to_city, fare_paise, travel_date, notes")
              .eq("id", row.request_id as string)
              .single();
            setDispatch({
              id:         row.id as string,
              request_id: row.request_id as string,
              expires_at: row.expires_at as string,
              request:    req,
            });
          } else if (["EXPIRED", "ACCEPTED", "REJECTED"].includes(row.status as string)) {
            setDispatch(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  const respond = useCallback(async (action: "accept" | "reject") => {
    if (!dispatch) return;
    setResponding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const eta_min = action === "accept"
        ? parseInt(prompt("Enter your ETA in minutes (e.g. 15):") || "30", 10)
        : undefined;

      const res = await fetch(`/api/requests/${dispatch.request_id}/respond`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, dispatch_id: dispatch.id, eta_min }),
      });

      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to respond"); return; }

      toast.success(action === "accept" ? "Ride accepted! Rider has been notified." : "Ride rejected.");
      setDispatch(null);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setResponding(false);
    }
  }, [dispatch]);

  if (!dispatch || !dispatch.request) return null;

  const { request } = dispatch;
  const pct = Math.round((secondsLeft / 60) * 100);

  return (
    <div className="bg-white border-2 border-amber-400 rounded-2xl p-4 shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-text">New Ride Request</span>
        </div>
        {/* Circular countdown */}
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#fde68a" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="20"
              fill="none"
              stroke={secondsLeft <= 15 ? "#ef4444" : "#f59e0b"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <span className={cn(
            "absolute inset-0 flex items-center justify-center text-xs font-bold",
            secondsLeft <= 15 ? "text-red-500" : "text-amber-600"
          )}>
            {secondsLeft}s
          </span>
        </div>
      </div>

      <div className="mb-4">
        <p className="font-bold text-text text-base">
          {request.from_city} → {request.to_city}
        </p>
        <p className="text-sm text-sub mt-0.5">
          ₹{Math.round(request.fare_paise / 100)} ·{" "}
          {new Date(request.travel_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </p>
        {request.notes && (
          <p className="text-xs text-sub mt-1 italic">{request.notes}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => respond("reject")}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-500 border border-red-200 font-bold py-3 rounded-xl text-sm"
        >
          {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : "✕ Reject"}
        </button>
        <button
          onClick={() => respond("accept")}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-1.5 bg-leaf text-white font-bold py-3 rounded-xl text-sm"
        >
          {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : "✓ Accept"}
        </button>
      </div>
    </div>
  );
}
