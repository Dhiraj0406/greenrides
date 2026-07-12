"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ChevronLeft, MapPin, Gauge, Fuel, Settings, Calendar, Phone, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shared/BottomNav";

interface Listing {
  id:           string;
  make:         string;
  model:        string;
  year:         number;
  price_paise:  string;
  mileage_km:   number | null;
  fuel_type:    string;
  transmission: string;
  location:     string;
  description:  string | null;
  photos:       string[];
  status:       string;
}

function formatPrice(paise: string): string {
  return `₹${(Number(paise) / 100).toLocaleString("en-IN")}`;
}

export default function ListingDetailPage() {
  const { id }                    = useParams<{ id: string }>();
  const router                    = useRouter();
  const [listing, setListing]     = useState<Listing | null>(null);
  const [loading, setLoading]     = useState(true);
  const [photoIdx, setPhotoIdx]   = useState(0);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [message, setMessage]     = useState("");

  useEffect(() => {
    fetch(`/api/used-cars/listings/${id}`)
      .then((r) => {
        if (r.status === 404) { router.replace("/used-cars"); return null; }
        return r.json();
      })
      .then((j) => { if (j) setListing(j.data); })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function submitInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(buyerPhone)) { toast.error("Enter a valid 10-digit phone number"); return; }
    setSubmitting(true);
    try {
      const res  = await fetch(`/api/used-cars/listings/${id}/inquire`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ buyer_name: buyerName, buyer_phone: buyerPhone, message: message || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Submission failed"); return; }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="green-container min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    );
  }

  if (!listing) return null;

  const sold = listing.status === "SOLD";
  const photos = listing.photos;

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      {/* Back nav */}
      <div className="bg-forest px-4 pt-safe-top pb-4">
        <div className="pt-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-lime/70">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-xl text-white">{listing.make} {listing.model}</h1>
        </div>
      </div>

      {/* Photo gallery */}
      {photos.length > 0 ? (
        <div className="px-4 pt-4">
          <div className="relative w-full aspect-video bg-pale rounded-2xl overflow-hidden mb-3">
            <img
              src={photos[photoIdx]}
              alt={`Photo ${photoIdx + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {photoIdx > 0 && (
              <button
                onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center"
              >
                ‹
              </button>
            )}
            {photoIdx < photos.length - 1 && (
              <button
                onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center"
              >
                ›
              </button>
            )}
            {sold && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-sm font-bold bg-red-500 px-4 py-2 rounded-full">This car has been sold</span>
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex justify-center gap-1.5 mb-3">
              {photos.map((_, i) => (
                <div
                  key={i}
                  className={photoIdx === i ? "w-2 h-2 rounded-full bg-forest" : "w-1.5 h-1.5 rounded-full bg-pale"}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4">
          <div className="w-full aspect-video bg-pale rounded-2xl flex items-center justify-center mb-3">
            <span className="text-sub text-sm">No photos</span>
          </div>
        </div>
      )}

      <div className="px-4 pt-4">
        {/* Price */}
        <p className="font-display text-3xl text-forest mb-1">{formatPrice(listing.price_paise)}</p>
        <p className="text-sub text-sm mb-4">{listing.year} · {listing.transmission.charAt(0) + listing.transmission.slice(1).toLowerCase()}</p>

        {/* Specs grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { icon: Calendar,  label: "Year",         value: String(listing.year)        },
            { icon: MapPin,    label: "Location",     value: listing.location            },
            { icon: Fuel,      label: "Fuel",         value: listing.fuel_type.charAt(0) + listing.fuel_type.slice(1).toLowerCase() },
            { icon: Settings,  label: "Transmission", value: listing.transmission.charAt(0) + listing.transmission.slice(1).toLowerCase() },
            ...(listing.mileage_km ? [{ icon: Gauge, label: "Mileage", value: `${listing.mileage_km.toLocaleString("en-IN")} km` }] : []),
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white border border-border rounded-xl p-3 flex items-center gap-2">
              <Icon className="w-4 h-4 text-leaf flex-shrink-0" />
              <div>
                <p className="text-[10px] text-sub">{label}</p>
                <p className="text-xs font-semibold text-text">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        {listing.description && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-sub uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-text">{listing.description}</p>
          </div>
        )}

        {/* Inquiry section */}
        {!sold && (
          <div className="mb-6">
            {submitted ? (
              <div className="bg-leaf/10 border border-leaf/30 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-leaf flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-text">Inquiry submitted!</p>
                  <p className="text-xs text-sub mt-0.5">We&apos;ll connect you with the seller soon.</p>
                </div>
              </div>
            ) : showForm ? (
              <form onSubmit={submitInquiry} className="bg-white border border-border rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-text">Your details</p>
                <input
                  type="text"
                  placeholder="Your name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  required
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  maxLength={10}
                  required
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
                />
                <textarea
                  placeholder="Message (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf resize-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-forest text-white text-sm font-semibold py-3 rounded-2xl disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit inquiry"}
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-forest text-white text-sm font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                I&apos;m Interested
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
