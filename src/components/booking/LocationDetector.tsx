"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";

type State = "idle" | "detecting" | "found" | "error";

export function LocationDetector() {
  const [state, setState] = useState<State>("idle");
  const { detectedCity, setDetectedCity, setOrigin } = useBookingStore();

  useEffect(() => {
    if (!navigator.geolocation) return;
    setState("detecting");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `/api/geo/detect?lat=${coords.latitude}&lng=${coords.longitude}`
          );
          const json = await res.json();
          if (json.data?.city) {
            const city = json.data.city as string;
            setDetectedCity(city);
            setOrigin(city);
            track.locationDetected(city);
            setState("found");
          } else {
            setState("error");
          }
        } catch {
          setState("error");
        }
      },
      () => setState("error"),
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [setDetectedCity, setOrigin]);

  if (state === "detecting") {
    return (
      <div className="flex items-center gap-2 text-sub text-sm px-4 py-2">
        <Loader2 className="w-4 h-4 animate-spin text-leaf" />
        <span>Detecting your location…</span>
      </div>
    );
  }

  if (state === "found" && detectedCity) {
    return (
      <div className="mx-4 mb-4 bg-forest/5 border border-leaf/20 rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-leaf animate-pulse" />
        <div className="flex-1">
          <p className="text-xs text-sub">Your location</p>
          <p className="text-sm font-semibold text-text">
            You&apos;re near {detectedCity}
          </p>
        </div>
        <button
          onClick={() => setState("error")}
          className="text-xs text-leaf underline"
        >
          Change
        </button>
      </div>
    );
  }

  return null;
}
