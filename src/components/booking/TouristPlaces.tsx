"use client";

import { MapPin } from "lucide-react";
import { useBookingStore } from "@/store/booking";
import { track } from "@/lib/analytics";
import type { TouristPlace } from "@/types";

const PLACES: TouristPlace[] = [
  {
    name:        "Duduma Waterfalls",
    city:        "Koraput",
    description: "One of Odisha's most dramatic waterfalls, 175m drop",
    image_hint:  "waterfall jungle",
    tag:         "Nature",
  },
  {
    name:        "Gupteswar Cave Temple",
    city:        "Koraput",
    description: "Ancient Shiva temple inside a massive limestone cave",
    image_hint:  "cave temple",
    tag:         "Spiritual",
  },
  {
    name:        "Kolab Reservoir",
    city:        "Jeypore",
    description: "Scenic dam with boat rides and lush surroundings",
    image_hint:  "dam lake",
    tag:         "Scenic",
  },
  {
    name:        "Deomali Peak",
    city:        "Koraput",
    description: "Odisha's highest peak at 1672m, tribal highlands",
    image_hint:  "mountain peak",
    tag:         "Trekking",
  },
  {
    name:        "Sunabeda Wildlife Sanctuary",
    city:        "Jeypore",
    description: "Dense forest sanctuary with tigers, leopards, sambar",
    image_hint:  "wildlife forest",
    tag:         "Wildlife",
  },
  {
    name:        "Jeypore Palace",
    city:        "Jeypore",
    description: "19th-century palace of the Jeypore royal family",
    image_hint:  "palace heritage",
    tag:         "Heritage",
  },
];

const TAG_COLORS: Record<string, string> = {
  Nature:    "bg-leaf/10 text-leaf",
  Spiritual: "bg-gold/10 text-gold",
  Scenic:    "bg-sky-50 text-sky-600",
  Trekking:  "bg-orange-50 text-orange-600",
  Wildlife:  "bg-forest-b/10 text-forest-b",
  Heritage:  "bg-purple-50 text-purple-600",
};

export function TouristPlaces() {
  const { origin, setDestination, setRouteData } = useBookingStore();

  const places = origin
    ? PLACES.filter((p) => p.city === origin)
    : PLACES.slice(0, 4);

  if (!places.length) return null;

  return (
    <section className="px-4 mt-8 pb-24">
      <h2 className="text-base font-semibold text-text mb-1">
        Explore {origin ?? "Odisha"}
      </h2>
      <p className="text-xs text-sub mb-3">Popular spots near you</p>

      <div className="flex flex-col gap-3">
        {places.map((place) => (
          <div
            key={place.name}
            className="bg-white border border-border rounded-2xl p-4
                       flex items-start gap-3"
          >
            {/* Icon placeholder */}
            <div className="w-12 h-12 rounded-xl bg-pale flex-shrink-0
                            flex items-center justify-center">
              <MapPin className="w-5 h-5 text-leaf" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-text truncate">
                  {place.name}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                              ${TAG_COLORS[place.tag] ?? "bg-pale text-sub"}`}
                >
                  {place.tag}
                </span>
              </div>
              <p className="text-xs text-sub mt-0.5 leading-relaxed">
                {place.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
