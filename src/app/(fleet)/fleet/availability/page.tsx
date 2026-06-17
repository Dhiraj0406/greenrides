"use client";

import { useEffect, useState } from "react";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildMonthDates(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Monday = 0 in our grid; JS getDay: 0=Sun,1=Mon,...,6=Sat
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MonthGrid({
  year,
  month,
  today,
  restDays,
  onToggle,
}: {
  year:     number;
  month:    number;
  today:    string;
  restDays: Record<string, string>;
  onToggle: (iso: string) => void;
}) {
  const cells = buildMonthDates(year, month);
  const label = new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year:  "numeric",
  });

  return (
    <div className="mb-6">
      <p className="font-display text-base text-forest mb-3">{label}</p>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-sub py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const iso    = toISO(date);
          const isPast = iso < today;
          const isRest = restDays[iso] === "rest";

          return (
            <button
              key={iso}
              disabled={isPast}
              onClick={() => onToggle(iso)}
              className={`
                aspect-square rounded-xl flex items-center justify-center text-xs font-semibold transition-colors
                ${isPast
                  ? "text-border bg-transparent cursor-default"
                  : isRest
                    ? "bg-gold/20 text-gold border border-gold/40"
                    : iso === today
                      ? "bg-leaf text-white"
                      : "bg-pale text-text hover:bg-lime/30"}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AvailabilityPage() {
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [restDays, setRestDays] = useState<Record<string, string>>({});

  const now   = new Date();
  const today = toISO(now);
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth();
  const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
  const nextYear  = thisMonth === 11 ? thisYear + 1 : thisYear;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      setToken(session.access_token);
      fetch("/api/fleet/availability", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.error) { toast.error(j.error); return; }
          setRestDays((j.data?.availability as Record<string, string>) ?? {});
        })
        .catch(() => toast.error("Failed to load availability"))
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  function toggleDay(iso: string) {
    setRestDays((prev) => {
      const next = { ...prev };
      if (next[iso] === "rest") {
        delete next[iso];
      } else {
        next[iso] = "rest";
      }
      return next;
    });
  }

  async function saveChanges() {
    if (!token) return;
    const snapshot = { ...restDays };
    setSaving(true);
    try {
      const res = await fetch("/api/fleet/availability", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ availability: restDays }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to save"); setRestDays(snapshot); return; }
      toast.success("Availability saved");
    } catch { toast.error("Network error"); setRestDays(snapshot); }
    finally { setSaving(false); }
  }

  const restCount = Object.keys(restDays).filter((d) => d >= today).length;

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-1">My Availability</h2>
      <div className="flex items-start gap-2 bg-pale rounded-xl px-3 py-2.5 mb-5 text-xs text-sub">
        <Info className="w-4 h-4 text-leaf flex-shrink-0 mt-0.5" />
        <span>Tap a day to mark it as a rest day (gold). You won&apos;t receive ride requests on rest days.</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-leaf" />
        </div>
      ) : (
        <>
          <MonthGrid
            year={thisYear}
            month={thisMonth}
            today={today}
            restDays={restDays}
            onToggle={toggleDay}
          />
          <MonthGrid
            year={nextYear}
            month={nextMonth}
            today={today}
            restDays={restDays}
            onToggle={toggleDay}
          />

          {/* ── Legend ───────────────────────────────────── */}
          <div className="flex items-center gap-4 mb-5 text-xs text-sub">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-leaf" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-pale border border-border" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-gold/20 border border-gold/40" />
              <span>Rest day</span>
            </div>
          </div>

          {restCount > 0 && (
            <p className="text-xs text-sub mb-3 text-center">
              {restCount} rest day{restCount !== 1 ? "s" : ""} marked
            </p>
          )}

          <button
            onClick={saveChanges}
            disabled={saving}
            className="w-full bg-leaf text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </button>
        </>
      )}
    </div>
  );
}
