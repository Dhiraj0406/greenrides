"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Drawer } from "vaul";
import {
  ChevronLeft, Loader2, CheckCircle2, CalendarDays,
  MessageCircle, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBookingStore } from "@/store/booking";
import { cn } from "@/lib/utils";

interface Props {
  open:       boolean;
  onClose:    () => void;
  from:       string;
  to:         string;
  fareRupees: number;
}

type DateOption = "today" | "tomorrow" | "custom";

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export function RequestSheet({ open, onClose, from, to, fareRupees }: Props) {
  const router = useRouter();
  const { distanceKm, durationText } = useBookingStore();

  const today    = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const [dateOption, setDateOption] = useState<DateOption>("today");
  const [customDate, setCustomDate] = useState(tomorrow);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId]   = useState<string | null>(null);
  const [error, setError]           = useState("");

  const selectedDate = dateOption === "today"
    ? today
    : dateOption === "tomorrow"
    ? tomorrow
    : customDate;

  // Reset on open
  useEffect(() => {
    if (open) {
      setDateOption("today");
      setCustomDate(tomorrow);
      setRequestId(null);
      setError("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      onClose();
      router.push("/login?next=/");
      return;
    }

    try {
      const res = await fetch("/api/requests", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          from_city:   from,
          to_city:     to,
          fare_paise:  fareRupees * 100,
          travel_date: selectedDate,
        }),
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRequestId(json.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const whatsappMsg = encodeURIComponent(
    `Hi, I want to book a full cab:\n*${from} → ${to}*\nDate: ${fmtDate(selectedDate)}\nFare: ₹${fareRupees}\nPlease confirm.`
  );
  const whatsappUrl = `https://wa.me/919999999999?text=${whatsappMsg}`;

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 green-container mx-auto
                     bg-white rounded-t-3xl px-6 pt-4 pb-10 focus:outline-none"
        >
          <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-5" />

          {/* ── Success state ─────────────────────────────── */}
          {requestId ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-leaf/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-leaf" />
              </div>
              <h2 className="font-display text-2xl text-forest mb-1">Cab Requested!</h2>
              <p className="text-sub text-sm mb-1">
                We received your booking for
              </p>
              <p className="font-semibold text-text text-sm mb-4">
                {from} → {to} · {fmtDate(selectedDate)}
              </p>
              <div className="bg-warm rounded-2xl px-4 py-3 w-full mb-5 text-left">
                <p className="text-xs text-sub mb-0.5">Request ID</p>
                <p className="font-mono-green text-sm font-semibold text-text">
                  {requestId.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <p className="text-sm text-sub mb-6">
                Our team will call you to confirm the driver within 30 minutes.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#25D366]
                           text-white font-semibold py-3.5 rounded-xl text-sm mb-3"
              >
                <MessageCircle className="w-4 h-4" />
                Also confirm on WhatsApp
              </a>
              <div className="flex items-center gap-4">
                <Link
                  href="/bookings"
                  className="text-sm text-leaf font-semibold underline"
                  onClick={onClose}
                >
                  View my trips →
                </Link>
                <button
                  onClick={onClose}
                  className="text-sm text-sub underline"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Back + title ──────────────────────────── */}
              <button
                onClick={onClose}
                className="flex items-center gap-1 text-sm text-sub mb-5"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              {/* ── Route + fare ──────────────────────────── */}
              <div className="bg-forest rounded-2xl p-4 mb-5 text-white">
                <div className="flex items-center gap-2 text-lime/70 text-sm mb-2">
                  <span className="font-semibold text-white">{from}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span className="font-semibold text-white">{to}</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="font-display text-4xl text-white">₹{fareRupees}</p>
                  <div className="text-right text-xs text-lime/60 font-mono-green">
                    {distanceKm && <p>{distanceKm} km</p>}
                    {durationText && <p>{durationText}</p>}
                  </div>
                </div>
                <p className="text-xs text-lime/50 mt-1">Full cab · Private hire · Cash on ride</p>
              </div>

              {/* ── Date picker ───────────────────────────── */}
              <div className="mb-5">
                <p className="text-sm font-semibold text-text mb-3 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-leaf" />
                  Travel date
                </p>
                <div className="flex gap-2 mb-3">
                  {(["today", "tomorrow"] as DateOption[]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setDateOption(opt)}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-sm font-semibold border transition-all",
                        dateOption === opt
                          ? "bg-forest border-leaf text-white"
                          : "bg-warm border-border text-text"
                      )}
                    >
                      {opt === "today" ? `Today · ${fmtDate(today)}` : `Tomorrow · ${fmtDate(tomorrow)}`}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setDateOption("custom")}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-semibold border transition-all text-left px-4",
                    dateOption === "custom"
                      ? "bg-forest border-leaf text-white"
                      : "bg-warm border-border text-text"
                  )}
                >
                  Pick a date
                </button>
                {dateOption === "custom" && (
                  <input
                    type="date"
                    value={customDate}
                    min={today}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="mt-2 w-full bg-warm border border-border rounded-xl px-4 py-3
                               text-sm text-text outline-none focus:border-leaf focus:ring-1 focus:ring-leaf/30"
                  />
                )}
              </div>

              {error && (
                <p className="text-xs text-red-500 mb-3">{error}</p>
              )}

              {/* ── CTA ───────────────────────────────────── */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-leaf hover:bg-leaf/90 disabled:opacity-60
                           text-white font-semibold py-4 rounded-xl touch-target
                           flex items-center justify-center gap-2 text-base
                           transition-colors mb-4"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `Request Cab · ₹${fareRupees}`
                )}
              </button>

              {/* ── WhatsApp fallback (S3) ────────────────── */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-sub">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 border border-[#25D366]
                           text-[#25D366] font-semibold py-3.5 rounded-xl text-sm
                           hover:bg-[#25D366]/5 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Book via WhatsApp instead
              </a>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
