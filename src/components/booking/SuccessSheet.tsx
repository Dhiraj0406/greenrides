// src/components/booking/SuccessSheet.tsx
"use client";

import { useEffect } from "react";

interface Props {
  bookingRef: string;
  onDone: () => void;
}

export function SuccessSheet({ bookingRef, onDone }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(17,17,9,.5)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full animate-sheet-up green-container mx-auto py-10 px-6 flex flex-col items-center text-center"
        style={{ background: "var(--paper)", borderRadius: "24px 24px 0 0" }}
      >
        {/* Animated ring + checkmark — 88×88px */}
        <div className="relative mb-5 animate-ring-pop" style={{ width: 88, height: 88 }}>
          <svg viewBox="0 0 88 88" className="w-full h-full">
            <circle cx="44" cy="44" r="40" stroke="var(--green-4)" strokeWidth="4" fill="none" />
            <circle
              cx="44" cy="44" r="40"
              stroke="var(--green)" strokeWidth="4" fill="none"
              strokeDasharray="251" strokeDashoffset="0"
              style={{ animation: "checkDraw .6s ease .2s both" }}
            />
          </svg>
          {/* Checkmark inside */}
          <svg
            viewBox="0 0 44 44"
            className="absolute inset-0 m-auto"
            style={{ width: 44, height: 44 }}
          >
            <polyline
              points="8,22 18,32 36,14"
              fill="none"
              stroke="var(--green)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="100"
              style={{ animation: "checkDraw .5s ease .5s both" }}
            />
          </svg>
        </div>

        <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--ink)" }}>
          Booking sent!
        </h2>
        <p className="text-sm mb-5" style={{ color: "var(--ink-3)" }}>
          Your booking has been sent on WhatsApp. We&apos;ll confirm within minutes.
        </p>

        {/* Reference chip */}
        <div
          className="px-4 py-2.5 rounded-full font-mono text-sm font-semibold mb-6"
          style={{ background: "var(--paper-3)", color: "var(--ink-2)" }}
        >
          {bookingRef}
        </div>

        <button
          onClick={onDone}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm"
          style={{ background: "var(--green)" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
