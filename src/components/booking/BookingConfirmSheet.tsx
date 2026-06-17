// src/components/booking/BookingConfirmSheet.tsx
"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmt } from "@/data/constants";
import * as Sentry from "@sentry/nextjs";

interface BookingDetails {
  from:    string;
  to:      string;
  rawDate: string;  // YYYY-MM-DD — sent to API
  date:    string;  // formatted display
  time:    string;
  fare:    number;  // rupees
  km:      number;
  dur:     string;
  name:    string;
  phone:   string;
}

interface Props {
  booking:   BookingDetails;
  onConfirm: (requestId: string) => void;
  onClose:   () => void;
}

export function BookingConfirmSheet({ booking, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Please log in to book."); setLoading(false); return; }

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          from_city:   booking.from,
          to_city:     booking.to,
          fare_paise:  booking.fare * 100,
          travel_date: booking.rawDate,
          notes:       booking.time ? `Pickup ${booking.time}` : undefined,
        }),
      });

      const text = await res.text();
      let json: { data?: { id: string } | null; error?: string | null };
      try {
        json = JSON.parse(text);
      } catch {
        // Non-JSON response — likely proxy error or server crash
        Sentry.captureMessage(`[BookingConfirmSheet] Non-JSON response ${res.status}: ${text.slice(0, 300)}`, "error");
        setError(`Server error (${res.status}). Please try again.`);
        return;
      }

      if (!res.ok) {
        setError(json.error || "Booking failed. Please try again.");
        return;
      }
      onConfirm(json.data!.id);
    } catch (err) {
      Sentry.captureException(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(17,17,9,.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div
        className="w-full animate-sheet-up green-container mx-auto"
        style={{
          background:   "var(--paper)",
          borderRadius: "24px 24px 0 0",
          maxHeight:    "90svh",
          overflowY:    "auto",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>
              Review your booking
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              Confirm details — a driver will be assigned immediately.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-3"
            style={{ background: "var(--paper-3)" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" style={{ color: "var(--ink-3)" }} />
          </button>
        </div>

        {/* Summary card */}
        <div
          className="mx-5 mb-4 rounded-2xl overflow-hidden border"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Route visualization */}
          <div className="p-4" style={{ background: "var(--green-5)" }}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 mt-0.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "var(--green)" }} />
                <div className="w-0.5 h-6" style={{ background: "var(--green-4)" }} />
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "var(--ink)" }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>{booking.from}</p>
                <p className="text-xs my-1.5" style={{ color: "var(--ink-4)" }}>
                  {booking.time} · {booking.date}
                </p>
                <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>{booking.to}</p>
              </div>
            </div>
          </div>

          {/* Fare row */}
          <div
            className="p-4 flex items-center justify-between border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <p className="font-display font-bold" style={{ color: "var(--green)", fontSize: "2rem" }}>
                {fmt(booking.fare)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                {booking.km} km · {booking.dur}
              </p>
            </div>
            <div className="text-right">
              <span
                className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{ background: "var(--green-5)", color: "var(--green)" }}
              >
                Fixed
              </span>
              <p className="text-[10px] mt-1" style={{ color: "var(--ink-4)" }}>Toll incl.</p>
              <p className="text-[10px] mt-1 font-semibold" style={{ color: "var(--ink-3)" }}>Pay cash to driver</p>
            </div>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 border-t" style={{ borderColor: "var(--border)" }}>
            {[
              { label: "Date",      value: booking.date        },
              { label: "Distance",  value: `${booking.km} km`  },
              { label: "Passenger", value: booking.name || "—" },
              { label: "Phone",     value: booking.phone || "—"},
            ].map(({ label, value }, i) => (
              <div key={label} className="p-3" style={{ borderBottom: i < 2 ? `1px solid var(--border)` : "none" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>{label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--ink)" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="px-5 pb-8 space-y-3">
          {error && (
            <div style={{ fontSize: 12, color: "#c53030", background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: "var(--r-md)", padding: "10px 14px" }}>
              {error}
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-white font-bold text-sm"
            style={{ background: "var(--green)", boxShadow: "0 4px 18px rgba(26,61,36,.3)", opacity: loading ? 0.8 : 1 }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding your driver…</>
              : <>Confirm &amp; Find Driver →</>
            }
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex items-center justify-center w-full py-3.5 rounded-2xl text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
          >
            Edit booking
          </button>
        </div>
      </div>
    </div>
  );
}
