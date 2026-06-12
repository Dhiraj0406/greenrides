// src/components/booking/BookingConfirmSheet.tsx
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { fmt } from "@/data/constants";

interface BookingDetails {
  ref:   string;
  from:  string;
  to:    string;
  date:  string;
  time:  string;
  fare:  number;
  km:    number;
  dur:   string;
  name:  string;
  phone: string;
}

interface Props {
  booking:   BookingDetails;
  onConfirm: () => void;
  onClose:   () => void;
}

export function BookingConfirmSheet({ booking, onConfirm, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const supportPhone = "919668021577";
  const waText = encodeURIComponent(
    `🚗 *${booking.ref}*\n\nPassenger: ${booking.name}\nPhone: ${booking.phone}\nFrom: ${booking.from}\nTo: ${booking.to}\nDate: ${booking.date}\nTime: ${booking.time}\nFare: ${fmt(booking.fare)}\n\nPlease confirm.`
  );
  const waUrl = `https://wa.me/${supportPhone}?text=${waText}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(17,17,9,.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
              Confirm details below — WhatsApp confirmation on next step.
            </p>
          </div>
          <button
            onClick={onClose}
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
              <p
                className="font-display font-bold"
                style={{ color: "var(--green)", fontSize: "2rem" }}
              >
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
            </div>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 border-t" style={{ borderColor: "var(--border)" }}>
            {[
              { label: "Date",      value: booking.date  },
              { label: "Distance",  value: `${booking.km} km` },
              { label: "Passenger", value: booking.name || "—"  },
              { label: "Phone",     value: booking.phone || "—" },
            ].map(({ label, value }, i) => (
              <div
                key={label}
                className="p-3"
                style={{ borderBottom: i < 2 ? `1px solid var(--border)` : "none" }}
              >
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>
                  {label}
                </p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--ink)" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="px-5 pb-8 space-y-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-white font-bold text-sm"
            style={{ background: "var(--wa)" }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Confirm on WhatsApp
          </a>
          <button
            onClick={onClose}
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
