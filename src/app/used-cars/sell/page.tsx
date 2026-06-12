"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronLeft, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

const FUEL_TYPES    = ["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"] as const;
const TRANSMISSIONS = ["MANUAL", "AUTOMATIC"] as const;

export default function SellPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);

  // Step 1 fields
  const [make, setMake]               = useState("");
  const [model, setModel]             = useState("");
  const [year, setYear]               = useState("");
  const [mileage, setMileage]         = useState("");
  const [fuelType, setFuelType]       = useState<typeof FUEL_TYPES[number] | "">("");
  const [transmission, setTransmission] = useState<typeof TRANSMISSIONS[number] | "">("");

  // Step 2 fields
  const [priceRupees, setPriceRupees] = useState("");
  const [location, setLocation]       = useState("");
  const [description, setDescription] = useState("");
  const [sellerName, setSellerName]   = useState("");
  const [sellerPhone, setSellerPhone] = useState("");

  // Step 3 fields
  const [photos, setPhotos] = useState<File[]>([]);

  function step1Valid() {
    return make && model && year && fuelType && transmission;
  }

  function step2Valid() {
    return priceRupees && location && sellerName && sellerPhone;
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 6 - photos.length);
    setPhotos((prev) => [...prev, ...newFiles].slice(0, 6));
  }

  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const pricePaise = Math.round(parseFloat(priceRupees) * 100);
      if (isNaN(pricePaise) || pricePaise <= 0) {
        toast.error("Invalid price"); return;
      }

      const fd = new FormData();
      fd.append("make",         make);
      fd.append("model",        model);
      fd.append("year",         year);
      fd.append("price_paise",  String(pricePaise));
      fd.append("fuel_type",    fuelType);
      fd.append("transmission", transmission);
      fd.append("location",     location);
      fd.append("seller_name",  sellerName);
      fd.append("seller_phone", sellerPhone);
      if (mileage)     fd.append("mileage_km",   mileage);
      if (description) fd.append("description",  description);
      for (const f of photos) fd.append("photos", f);

      // Do NOT set Content-Type — browser sets multipart boundary automatically
      const res  = await fetch("/api/used-cars/listings", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Submission failed"); return; }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="green-container min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-leaf/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-leaf" />
        </div>
        <h2 className="font-display text-2xl text-forest mb-2">Listing submitted!</h2>
        <p className="text-sm text-sub mb-6">Your listing is under review. We&apos;ll publish it within 24 hours.</p>
        <button
          onClick={() => router.push("/used-cars")}
          className="bg-forest text-white text-sm font-semibold px-6 py-3 rounded-2xl"
        >
          Browse listings
        </button>
      </div>
    );
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      {/* Header */}
      <div className="bg-forest px-4 pt-safe-top pb-4">
        <div className="pt-4 flex items-center gap-3">
          <button onClick={() => (step > 1 ? setStep((s) => (s - 1) as Step) : router.back())}
            className="text-lime/70">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-xl text-white">Sell your car</h1>
        </div>
        {/* Step progress */}
        <div className="flex gap-1.5 mt-4">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-lime" : "bg-white/20"}`} />
          ))}
        </div>
        <p className="text-lime/60 text-xs mt-1.5">Step {step} of 3</p>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* ── Step 1: Vehicle details ──────────────────── */}
        {step === 1 && (
          <>
            <p className="text-sm font-semibold text-sub uppercase tracking-wider">Vehicle details</p>

            {[
              { label: "Make",  value: make,  set: setMake,  placeholder: "e.g. Maruti, Honda" },
              { label: "Model", value: model, set: setModel, placeholder: "e.g. Swift, City"   },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-sub mb-1 block">{label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
                />
              </div>
            ))}

            <div>
              <label className="text-xs font-semibold text-sub mb-1 block">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2019"
                min={1990}
                max={new Date().getFullYear() + 1}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-sub mb-1 block">Mileage (km) — optional</label>
              <input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="e.g. 45000"
                min={0}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-sub mb-2 block">Fuel type</label>
              <div className="flex flex-wrap gap-2">
                {FUEL_TYPES.map((f) => (
                  <button key={f} type="button"
                    onClick={() => setFuelType(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                      ${fuelType === f ? "bg-forest text-white border-forest" : "bg-white border-border text-sub"}`}
                  >
                    {f.charAt(0) + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-sub mb-2 block">Transmission</label>
              <div className="flex gap-2">
                {TRANSMISSIONS.map((t) => (
                  <button key={t} type="button"
                    onClick={() => setTransmission(t)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors
                      ${transmission === t ? "bg-forest text-white border-forest" : "bg-white border-border text-sub"}`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid()}
              className="w-full bg-forest text-white text-sm font-semibold py-3.5 rounded-2xl disabled:opacity-40 mt-2"
            >
              Next
            </button>
          </>
        )}

        {/* ── Step 2: Price & contact ──────────────────── */}
        {step === 2 && (
          <>
            <p className="text-sm font-semibold text-sub uppercase tracking-wider">Price & contact</p>

            <div>
              <label className="text-xs font-semibold text-sub mb-1 block">Asking price (₹)</label>
              <input
                type="number"
                value={priceRupees}
                onChange={(e) => setPriceRupees(e.target.value)}
                placeholder="e.g. 350000"
                min={1000}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
              />
              {priceRupees && (
                <p className="text-xs text-leaf mt-1">
                  = ₹{(Number(priceRupees) / 100000).toFixed(2)} lakh
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-sub mb-1 block">Location (city / area)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bhubaneswar"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-sub mb-1 block">Description — optional</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Condition, service history, accessories…"
                rows={3}
                maxLength={1000}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-sub mb-1 block">Your name</label>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-sub mb-1 block">Your phone number</label>
              <input
                type="tel"
                value={sellerPhone}
                onChange={(e) => setSellerPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-leaf"
              />
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!step2Valid()}
              className="w-full bg-forest text-white text-sm font-semibold py-3.5 rounded-2xl disabled:opacity-40 mt-2"
            >
              Next
            </button>
          </>
        )}

        {/* ── Step 3: Photos ───────────────────────────── */}
        {step === 3 && (
          <>
            <p className="text-sm font-semibold text-sub uppercase tracking-wider">Photos</p>
            <p className="text-xs text-sub">Add up to 6 photos (max 5 MB each). Good lighting = faster sale.</p>

            {photos.length < 6 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-2xl py-8 text-center text-sub text-sm"
              >
                + Add photos
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files)}
            />

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((f, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full bg-forest text-white text-sm font-semibold py-3.5 rounded-2xl disabled:opacity-40 mt-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit listing"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}