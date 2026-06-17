// src/components/drivers/AvailabilityCalendar.tsx
"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DayEntry = { start: string; end: string } | "rest";
type Availability = Record<string, DayEntry>;

function toDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getRequiredKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    keys.push(toDateKey(d));
  }
  return keys;
}

const HOURS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, "0")}:00`
);

interface Props {
  value: Availability;
  onChange: (next: Availability) => void;
}

export function AvailabilityCalendar({ value, onChange }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected]   = useState<string | null>(toDateKey(today));

  const requiredKeys = useMemo(() => getRequiredKeys(), []);

  const unfilledRequired = requiredKeys.filter((k) => !value[k]);
  const selectedEntry    = selected ? value[selected] : undefined;

  // Calendar grid helpers
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey    = toDateKey(today);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function setDayEntry(key: string, entry: DayEntry) {
    onChange({ ...value, [key]: entry });
  }
  function clearDay(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="space-y-4">
      {unfilledRequired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-medium">
          ⚠️ {unfilledRequired.length} required day{unfilledRequired.length > 1 ? "s" : ""} not filled — go online is blocked until complete.
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1 text-sub hover:text-text">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-sm text-text">{monthNames[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="p-1 text-sub hover:text-text">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-[10px] font-bold text-sub py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(viewYear, viewMonth, i + 1);
          const key  = toDateKey(date);
          const isPast     = date < today;
          const isToday    = key === todayKey;
          const isRequired = requiredKeys.includes(key);
          const entry      = value[key];
          const isSelected = key === selected;

          const dayClass = cn(
            "aspect-square flex flex-col items-center justify-center rounded-lg text-[11px] font-semibold cursor-pointer select-none border transition-all",
            isPast && "opacity-30 cursor-not-allowed border-transparent text-sub",
            !isPast && !entry && !isRequired && "bg-white border-border text-sub hover:border-leaf/40",
            !isPast && !entry && isRequired && "bg-white border-red-400 text-text shadow-[0_0_0_1.5px_#ef4444]",
            !isPast && entry === "rest" && "bg-amber-50 border-amber-400 text-amber-800",
            !isPast && entry && entry !== "rest" && "bg-green-50 border-green-400 text-green-800",
            isSelected && !isPast && "ring-2 ring-leaf ring-offset-1",
            isToday && !isPast && "outline outline-2 outline-lime outline-offset-1"
          );

          return (
            <div
              key={key}
              className={dayClass}
              onClick={() => !isPast && setSelected(key)}
            >
              {i + 1}
              {!isPast && entry && (
                <div className={cn("w-1 h-1 rounded-full mt-0.5", entry === "rest" ? "bg-amber-500" : "bg-green-500")} />
              )}
              {!isPast && !entry && isRequired && (
                <div className="w-1 h-1 rounded-full mt-0.5 bg-red-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-sub">
        {[
          { color: "bg-green-400", label: "Available" },
          { color: "bg-amber-400", label: "Rest day" },
          { color: "border border-red-400", label: "Required, unfilled" },
          { color: "bg-gray-200", label: "Optional" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded-sm inline-block", color)} />{label}
          </span>
        ))}
      </div>

      {/* Selected day detail */}
      {selected && new Date(selected + "T00:00:00") >= today && (
        <div className="bg-white border border-leaf/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-text">
              {new Date(selected + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </span>
            {requiredKeys.includes(selected) ? (
              <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold">Required</span>
            ) : (
              <span className="text-[10px] bg-gray-50 text-sub border border-border px-2 py-0.5 rounded-full">Optional</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setDayEntry(selected, { start: "08:00", end: "18:00" })}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                selectedEntry && selectedEntry !== "rest"
                  ? "bg-green-50 border-green-400 text-green-800"
                  : "bg-gray-50 border-border text-sub"
              )}
            >
              ✓ Available
            </button>
            <button
              onClick={() => setDayEntry(selected, "rest")}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                selectedEntry === "rest"
                  ? "bg-amber-50 border-amber-400 text-amber-800"
                  : "bg-gray-50 border-border text-sub"
              )}
            >
              ✕ Rest Day
            </button>
            {selectedEntry && (
              <button
                onClick={() => clearDay(selected)}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-border text-sub bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>

          {selectedEntry && selectedEntry !== "rest" && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[10px] text-sub mb-1">Start time</p>
                <select
                  value={selectedEntry.start}
                  onChange={(e) => setDayEntry(selected, { ...selectedEntry, start: e.target.value })}
                  className="w-full bg-gray-50 border border-border rounded-lg px-3 py-2 text-sm font-semibold text-text"
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <span className="text-sub mt-4">—</span>
              <div className="flex-1">
                <p className="text-[10px] text-sub mb-1">End time</p>
                <select
                  value={selectedEntry.end}
                  onChange={(e) => setDayEntry(selected, { ...selectedEntry, end: e.target.value })}
                  className="w-full bg-gray-50 border border-border rounded-lg px-3 py-2 text-sm font-semibold text-text"
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
