"use client";

import { Check } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const ORIGINS = [
  { city: "Koraput",  subtitle: "District HQ · Hill town" },
  { city: "Jeypore",  subtitle: "Koraput district · Commercial hub" },
];

export function OriginPicker() {
  const { origin, setOrigin } = useBookingStore();

  function handleSelect(city: string) {
    setOrigin(city);
    track.originSelected(city);
  }

  return (
    <section className="px-4">
      <h2 className="text-base font-semibold text-text mb-3">
        Where are you starting from?
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {ORIGINS.map(({ city, subtitle }) => {
          const active = origin === city;
          return (
            <button
              key={city}
              onClick={() => handleSelect(city)}
              className={cn(
                "relative flex flex-col items-start p-4 rounded-2xl border touch-target",
                "transition-all duration-200 text-left",
                active
                  ? "bg-forest border-leaf text-white"
                  : "bg-white border-border text-text hover:border-leaf/50"
              )}
            >
              {active && (
                <span className="absolute top-3 right-3">
                  <Check className="w-4 h-4 text-lime" />
                </span>
              )}
              <span className={cn("font-semibold text-base", active && "text-lime")}>
                {city}
              </span>
              <span
                className={cn(
                  "text-xs mt-0.5 leading-tight",
                  active ? "text-lime/70" : "text-sub"
                )}
              >
                {subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
