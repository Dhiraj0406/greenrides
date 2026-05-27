import { STATIC_ROUTES } from "@/data/static-routes";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Leaf } from "lucide-react";

function toSlug(city: string) {
  return city.toLowerCase().replace(/\s+/g, "-");
}

function fromSlug(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function generateStaticParams() {
  return STATIC_ROUTES.map((r) => ({
    slug: `${toSlug(r.from_city)}-to-${toSlug(r.to_city)}`,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parts = slug.split("-to-");
  if (parts.length < 2) return { title: "Route Not Found" };
  const from = fromSlug(parts[0]);
  const to   = fromSlug(parts.slice(1).join("-to-"));
  return {
    title:       `${from} to ${to} Cab | Green Rides`,
    description: `Book a private cab from ${from} to ${to}. Verified drivers, fixed fares, hill routes covered. Starting from ₹500.`,
  };
}

export default async function RoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parts = slug.split("-to-");
  if (parts.length < 2) return notFound();

  const from = fromSlug(parts[0]);
  const to   = fromSlug(parts.slice(1).join("-to-"));

  const route = STATIC_ROUTES.find(
    (r) => r.from_city.toLowerCase() === from.toLowerCase() && r.to_city.toLowerCase() === to.toLowerCase()
  );

  if (!route) return notFound();

  const highlights = [
    { label: "Distance",    value: `${route.distance_km} km` },
    { label: "Duration",    value: route.duration_text },
    { label: "Starting at", value: `₹${route.fare_rupees}` },
    { label: "Seats",       value: "Up to 6" },
  ];

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      <header className="bg-forest px-4 pt-safe-top pb-8">
        <div className="pt-4 flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-leaf flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg text-lime">Green Rides</span>
        </div>
        <h1 className="font-display text-3xl text-white mb-2">
          {route.from_city}
          <span className="text-lime/60 mx-3">→</span>
          {route.to_city}
        </h1>
        <p className="text-lime/60 text-sm">Private cab · Verified driver · Fixed fare</p>
      </header>

      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 mb-4 grid grid-cols-2 gap-3">
          {highlights.map((h) => (
            <div key={h.label} className="text-center p-3 bg-cream rounded-xl">
              <p className="font-display text-xl text-forest">{h.value}</p>
              <p className="text-xs text-sub mt-0.5">{h.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-border p-4 mb-4">
          <h2 className="font-semibold text-text mb-3">About this route</h2>
          <p className="text-sm text-sub leading-relaxed">
            Travel comfortably from <strong>{route.from_city}</strong> to <strong>{route.to_city}</strong> in a private cab with Green Rides.
            Our drivers know the Odisha hill routes well — enjoy a safe, smooth {route.duration_text} journey across {route.distance_km} km of scenic terrain.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-sub">
            <MapPin className="w-3.5 h-3.5 text-leaf flex-shrink-0" />
            <span>Pickup from your location in {route.from_city}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-sub">
            <Clock className="w-3.5 h-3.5 text-leaf flex-shrink-0" />
            <span>Estimated travel time: {route.duration_text}</span>
          </div>
        </div>

        <div className="bg-forest rounded-2xl p-5 text-white mb-4">
          <h2 className="font-display text-xl text-lime mb-1">Ready to book?</h2>
          <p className="text-lime/60 text-sm mb-4">Search available cabs or request a private ride.</p>
          <Link
            href={`/?from=${encodeURIComponent(route.from_city)}&to=${encodeURIComponent(route.to_city)}`}
            className="flex items-center justify-center gap-2 bg-leaf text-white font-bold py-3.5 rounded-xl text-sm"
          >
            Book {route.from_city} → {route.to_city}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <p className="text-center text-xs text-sub pb-4">
          Fares are fixed and include fuel. No surge pricing.
        </p>
      </div>
    </div>
  );
}
