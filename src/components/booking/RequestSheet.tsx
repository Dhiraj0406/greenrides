"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Drawer } from "vaul";
import {
  ChevronLeft, Loader2, CheckCircle2, CalendarDays,
  Clock, MessageCircle, ArrowRight,
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

const TIME_SLOTS = [
  { id: "early",     label: "Early Morning", time: "06:00", sub: "5 – 8 AM"  },
  { id: "morning",   label: "Morning",        time: "09:00", sub: "8 – 11 AM" },
  { id: "afternoon", label: "Afternoon",      time: "13:00", sub: "12 – 4 PM" },
  { id: "evening",   label: "Evening",        time: "17:00", sub: "4 – 7 PM"  },
  { id: "night",     label: "Night",          time: "20:00", sub: "7 – 10 PM" },
  { id: "custom",    label: "Custom time",    time: "",      sub: "Pick time"  },
] as const;

type TimeSlotId = typeof TIME_SLOTS[number]["id"];

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}
function fmtTime(time: string) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr   = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function RequestSheet({ open, onClose, from, to, fareRupees }: Props) {
  const router = useRouter();
  const { distanceKm, durationText } = useBookingStore();

  const today    = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const [dateOption, setDateOption] = useState<DateOption>("today");
  const [customDate, setCustomDate] = useState(tomorrow);
  const [timeSlot, setTimeSlot]     = useState<TimeSlotId>("morning");
  const [customTime, setCustomTime] = useState("10:00");
  const [preferredTime, setPreferredTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId]   = useState<string | null>(null);
  const [error, setError]           = useState("");

  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const selectedDate = dateOption === "today"
    ? today
    : dateOption === "tomorrow"
    ? tomorrow
    : customDate;

  const selectedSlot   = TIME_SLOTS.find((s) => s.id === timeSlot)!;
  const resolvedTime   = timeSlot === "custom" ? customTime : selectedSlot.time;
  const timeLabel      = timeSlot === "custom"
    ? `Custom · ${fmtTime(customTime)}`
    : `${selectedSlot.label} · ${fmtTime(selectedSlot.time)}`;

  // Reset on open
  useEffect(() => {
    if (open) {
      setDateOption("today");
      setCustomDate(tomorrow);
      setTimeSlot("morning");
      setCustomTime("10:00");
      setPreferredTime("");
      setRequestId(null);
      setError("");
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSubmitting(false);
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
          from_city:      from,
          to_city:        to,
          fare_paise:     fareRupees * 100,
          travel_date:    selectedDate,
          notes:          `Preferred time: ${timeLabel}${resolvedTime ? ` (${resolvedTime})` : ""}`,
          preferred_time: preferredTime || undefined,
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
    `Hi, I want to book a full cab:\n*${from} → ${to}*\nDate: ${fmtDate(selectedDate)}\nTime: ${timeLabel}\nFare: ₹${fareRupees}\nPlease confirm.`
  );
  const whatsappUrl = `https://wa.me/919668021577?text=${whatsappMsg}`;

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content
          aria-label="Book a ride"
          className="fixed bottom-0 left-0 right-0 z-50 green-container mx-auto
                     bg-white rounded-t-3xl focus:outline-none
                     max-h-[90vh] flex flex-col"
        >
          <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-4 mb-5 flex-shrink-0" />

          {/* ── Scrollable body ───────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6">
            {/* ── Success state ─────────────────────────────── */}
            {requestId ? (
              <div className="flex flex-col items-center text-center py-4 pb-10">
                <div className="w-16 h-16 rounded-full bg-leaf/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-leaf" />
                </div>
                <h2 className="font-display text-2xl text-forest mb-1">Cab Requested!</h2>
                <p className="text-sub text-sm mb-1">We received your booking for</p>
                <p className="font-semibold text-text text-sm mb-4">
                  {from} → {to} · {fmtDate(selectedDate)} · {timeLabel.split(" · ")[0]}
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
                  <button onClick={onClose} className="text-sm text-sub underline">
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
                  <div className="flex gap-2 mb-2">
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
                        {opt === "today"
                          ? `Today · ${fmtDate(today)}`
                          : `Tomorrow · ${fmtDate(tomorrow)}`}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setDateOption("custom")}
                    className={cn(
                      "w-full py-3 rounded-xl text-sm font-semibold border transition-all px-4 text-left",
                      dateOption === "custom"
                        ? "bg-forest border-leaf text-white"
                        : "bg-warm border-border text-text"
                    )}
                  >
                    {dateOption === "custom"
                      ? `📅 ${fmtDate(customDate)}`
                      : "Pick another date"}
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={customDate}
                    min={today}
                    onChange={(e) => {
                      if (e.target.value) setCustomDate(e.target.value);
                    }}
                    className={cn(
                      "mt-2 w-full bg-warm border border-border rounded-xl px-4 py-3",
                      "text-sm text-text outline-none focus:border-leaf focus:ring-1 focus:ring-leaf/30",
                      dateOption !== "custom" && "hidden"
                    )}
                  />
                </div>

                {/* ── Time picker ───────────────────────────── */}
                <div className="mb-4">
                  <p className="text-sm font-semibold text-text mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-leaf" />
                    Departure time
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setTimeSlot(slot.id)}
                        className={cn(
                          "flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all",
                          timeSlot === slot.id
                            ? "bg-forest border-leaf text-white"
                            : "bg-warm border-border text-text"
                        )}
                      >
                        <span className="text-xs font-semibold leading-tight">{slot.label}</span>
                        <span className={cn(
                          "text-[10px] mt-0.5 leading-none",
                          timeSlot === slot.id ? "text-lime/70" : "text-sub"
                        )}>
                          {slot.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                  <input
                    ref={timeInputRef}
                    type="time"
                    value={customTime}
                    onChange={(e) => {
                      if (e.target.value) setCustomTime(e.target.value);
                    }}
                    className={cn(
                      "mt-2 w-full bg-warm border border-border rounded-xl px-4 py-3",
                      "text-sm text-text outline-none focus:border-leaf focus:ring-1 focus:ring-leaf/30",
                      timeSlot !== "custom" && "hidden"
                    )}
                  />
                </div>

                {/* ── Preferred time of day ─────────────────── */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-sub mb-2">Preferred Time of Day (optional)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "EARLY_MORNING", label: "🌄 Early Morning", sub: "Before 8 AM" },
                      { value: "MORNING",       label: "🌅 Morning",       sub: "8 AM – 12 PM" },
                      { value: "AFTERNOON",     label: "☀️ Afternoon",      sub: "12 PM – 5 PM" },
                      { value: "EVENING",       label: "🌇 Evening",        sub: "After 5 PM" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPreferredTime(prev => prev === opt.value ? "" : opt.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          preferredTime === opt.value
                            ? "border-leaf bg-leaf/10 text-leaf"
                            : "border-border bg-white text-sub hover:border-leaf/40"
                        }`}
                      >
                        <p className="text-sm font-semibold">{opt.label}</p>
                        <p className="text-[10px] mt-0.5">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 mb-3">{error}</p>
                )}
              </>
            )}
          </div>

          {/* ── Sticky footer CTA (booking form only) ─────── */}
          {!requestId && (
            <div className="flex-shrink-0 px-6 pt-3 pb-safe-bottom pb-8 bg-white border-t border-border">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-leaf hover:bg-leaf/90 disabled:opacity-60
                           text-white font-semibold py-4 rounded-xl touch-target
                           flex items-center justify-center gap-2 text-base
                           transition-colors mb-3"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `Request Cab · ₹${fareRupees}`
                )}
              </button>
              <div className="flex items-center gap-3 mb-3">
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
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
