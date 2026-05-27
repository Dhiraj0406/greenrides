"use client";

import { Compass, ChevronRight } from "lucide-react";
import { useBookingStore } from "@/store/booking";

interface DayTrip {
  name:        string;
  description: string;
  fare:        number;
  distanceKm:  number;
  tag:         string;
  emoji:       string;
  gradient:    string;
  tagColor:    string;
}

const DAY_TRIPS: DayTrip[] = [
  {
    name:        "Deomali Peak",
    description: "Highest peak in Odisha · Tribal village views",
    fare:        2000,
    distanceKm:  53,
    tag:         "Nature",
    emoji:       "⛰️",
    gradient:    "from-[#0d2818] to-[#1a5c30]",
    tagColor:    "bg-lime/20 text-lime",
  },
  {
    name:        "Gupteswar Cave",
    description: "Ancient Shiva shrine · Sacred forest trail",
    fare:        3000,
    distanceKm:  76,
    tag:         "Pilgrimage",
    emoji:       "🕌",
    gradient:    "from-[#2a1a40] to-[#4a2d6e]",
    tagColor:    "bg-purple-200/20 text-purple-200",
  },
  {
    name:        "Duduma Falls",
    description: "500ft waterfall · Machkund river canyon",
    fare:        2700,
    distanceKm:  68,
    tag:         "Waterfall",
    emoji:       "💧",
    gradient:    "from-[#0a2940] to-[#1a5c7e]",
    tagColor:    "bg-sky-200/20 text-sky-200",
  },
  {
    name:        "Kolab Reservoir",
    description: "Scenic dam & boating · Golden sunset views",
    fare:        1000,
    distanceKm:  14,
    tag:         "Scenic",
    emoji:       "🌅",
    gradient:    "from-[#3d2200] to-[#8b5000]",
    tagColor:    "bg-amber-200/20 text-amber-200",
  },
  {
    name:        "Sunabeda Wildlife",
    description: "Tiger reserve buffer · Wildlife morning trails",
    fare:        1500,
    distanceKm:  39,
    tag:         "Wildlife",
    emoji:       "🐯",
    gradient:    "from-[#1a2d0d] to-[#3d5c1a]",
    tagColor:    "bg-green-200/20 text-green-200",
  },
];

export function DayTrips() {
  const { setDestination, setRouteData, setDiscount } = useBookingStore();

  function selectTrip(trip: DayTrip) {
    setDestination(trip.name);
    setRouteData({
      km:   trip.distanceKm,
      min:  Math.round((trip.distanceKm / 45) * 60),
      text: `${Math.floor(trip.distanceKm / 45)}h ${Math.round(((trip.distanceKm / 45) % 1) * 60)}m`,
      fare: trip.fare,
    });
    setDiscount(0, "Full day trip · Return included");
    setTimeout(() => {
      document.getElementById("fare-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  return (
    <section className="px-4 mt-8">
      <div className="flex items-center gap-2 mb-1">
        <Compass className="w-4 h-4 text-leaf" />
        <p className="text-xs font-semibold text-sub uppercase tracking-wide">
          Tourist Day Trips
        </p>
      </div>
      <p className="text-[11px] text-sub/60 mb-4 pl-6">Full day · Private cab · Return included</p>

      <div className="grid grid-cols-2 gap-2.5">
        {DAY_TRIPS.map((trip, i) => (
          <button
            key={trip.name}
            onClick={() => selectTrip(trip)}
            style={{ animationDelay: `${i * 0.07}s` }}
            className={`flex flex-col items-start rounded-2xl text-left
                        touch-target overflow-hidden
                        transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                        shadow-md hover:shadow-xl animate-fade-in-up`}
          >
            {/* Gradient image area */}
            <div className={`w-full bg-gradient-to-br ${trip.gradient} px-3.5 pt-3 pb-2`}>
              <span className="text-2xl leading-none block mb-2">{trip.emoji}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trip.tagColor}`}>
                {trip.tag}
              </span>
            </div>
            {/* Info area */}
            <div className="bg-white w-full px-3.5 py-2.5 border-x border-b border-border rounded-b-2xl">
              <span className="font-semibold text-sm leading-tight text-text block">
                {trip.name}
              </span>
              <span className="text-[11px] text-sub mt-0.5 leading-snug line-clamp-2 block">
                {trip.description}
              </span>
              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-forest text-sm">
                  ₹{trip.fare.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-sub font-mono-green">{trip.distanceKm} km</span>
              </div>
            </div>
          </button>
        ))}

        {/* Custom route CTA */}
        <button
          onClick={() =>
            document.getElementById("custom-route")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="flex flex-col items-start justify-between rounded-2xl
                     border-2 border-dashed border-leaf/40 bg-pale/60
                     px-3.5 py-4 text-left touch-target
                     transition-all duration-200 hover:border-leaf hover:bg-pale
                     animate-fade-in-up"
          style={{ animationDelay: "0.35s" }}
        >
          <span className="text-2xl leading-none mb-2">✨</span>
          <span className="text-[10px] font-bold text-leaf bg-leaf/10 px-1.5 py-0.5 rounded-full mb-2">
            Custom
          </span>
          <span className="font-semibold text-sm leading-tight text-forest">
            Any other place?
          </span>
          <span className="text-[11px] text-sub mt-1">Get an AI estimate</span>
          <div className="flex items-center gap-1 mt-3 text-leaf text-xs font-semibold">
            <span>Estimate fare</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>
    </section>
  );
}
