"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { PICKUP_TIMES, fmt } from "@/data/constants";
import { Loader2, X } from "lucide-react";

const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const selStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--paper-2)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-md)",
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--ink)",
  outline: "none",
  WebkitAppearance: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a7870' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 34,
  cursor: "pointer",
  boxSizing: "border-box" as const,
  transition: "border-color .2s",
};

const inpStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--paper-2)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-md)",
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color .2s",
};

export interface DayTrip {
  name: string;
  emoji: string;
  tag: string;
  fare: number;
  km: number;
  desc: string;
}

interface Props {
  trip: DayTrip;
  onClose: () => void;
  onSuccess: (requestId: string) => void;
}

export function DayTripBookSheet({ trip, onClose, onSuccess }: Props) {
  const [date, setDate]       = useState(todayStr());
  const [time, setTime]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const canBook = !!(date && time);

  async function handleBook() {
    if (!canBook || loading) return;
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Please log in to book a trip.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          from_city:   "Koraput",
          to_city:     trip.name,
          fare_paise:  trip.fare * 100,
          travel_date: date,
          notes:       `Day trip · Pickup ${time}`,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Booking failed. Please try again.");
        return;
      }

      onSuccess(json.data.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: 420,
          background: "#fff",
          borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          overflow: "hidden",
          boxShadow: "0 -8px 40px rgba(0,0,0,.18)",
        }}
      >
        {/* Green header */}
        <div style={{ background: "var(--green)", padding: "20px 20px 22px", position: "relative" }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 14, right: 14,
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(255,255,255,.15)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
          >
            <X size={16} />
          </button>

          <div style={{ fontSize: 40, marginBottom: 10 }}>{trip.emoji}</div>

          <div style={{
            display: "inline-block",
            fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.75)",
            letterSpacing: ".07em", textTransform: "uppercase",
            background: "rgba(255,255,255,.15)", borderRadius: 999,
            padding: "3px 10px", marginBottom: 8,
          }}>
            Day Trip · {trip.tag}
          </div>

          <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-.3px", lineHeight: 1.2 }}>
            {trip.name}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 4 }}>{trip.desc}</div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 30, fontWeight: 700, color: "#fff", letterSpacing: "-.5px" }}>
              {fmt(trip.fare)}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>{trip.km} km return · toll incl.</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 5 }}>Date</div>
              <input
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                style={inpStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 5 }}>Pickup time</div>
              <select value={time} onChange={(e) => setTime(e.target.value)} style={selStyle}>
                <option value="">Pick time</option>
                {PICKUP_TIMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{
            background: "var(--green-5)", border: "1px solid var(--green-4)",
            borderRadius: "var(--r-md)", padding: "10px 14px",
            fontSize: 12, color: "var(--green)",
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <span style={{ flexShrink: 0 }}>📍</span>
            <span>Pickup from Koraput. A driver will be assigned and you will be notified once confirmed.</span>
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: "#c53030",
              background: "#fff5f5", border: "1px solid #fed7d7",
              borderRadius: "var(--r-md)", padding: "10px 14px",
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleBook}
            disabled={!canBook || loading}
            style={{
              width: "100%", height: 52,
              background: canBook ? "var(--green)" : "var(--paper-3)",
              color: canBook ? "#fff" : "var(--ink-4)",
              borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600,
              border: "none",
              cursor: canBook && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: canBook ? "0 4px 16px rgba(26,61,36,.25)" : "none",
              opacity: loading ? 0.75 : 1,
              transition: "all .2s",
            }}
          >
            {loading
              ? <Loader2 size={18} className="animate-spin" />
              : canBook
                ? <>{`Confirm · ${fmt(trip.fare)}`} <span>→</span></>
                : "Select date & time to book"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
