"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
type RegType = "driver" | "owner" | "both";

export default function FleetRegisterPage() {
  const router = useRouter();
  const [step, setStep]       = useState<"phone" | "form">("phone");
  const [phone, setPhone]     = useState("");
  const [otp, setOtp]         = useState("");
  const [type, setType]       = useState<RegType>("driver");
  const [form, setForm]       = useState({
    name: "", license_number: "", vehicle_type: "", vehicle_number: "", vehicle_model: "", email: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    setLoading(true);
    try {
      const { sendOtp } = await import("@/lib/phone-auth");
      await sendOtp(phone);
      setStep("form");
      toast.success("OTP sent (or enter your test OTP)");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const { verifyOtp } = await import("@/lib/phone-auth");
      const session = await verifyOtp(phone, otp);

      const res = await fetch("/api/fleet/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ type, ...form }),
      });
      const json = await res.json();
      if (json.error) { toast.error(json.error); return; }
      router.replace("/fleet/pending");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  const needsDriver = type === "driver" || type === "both";
  const needsOwner  = type === "owner"  || type === "both";

  return (
    <div className="green-container min-h-screen bg-cream px-4 py-8">
      <div className="mb-8">
        <p className="text-leaf text-xs font-mono-green uppercase tracking-widest mb-1">Green Rides</p>
        <h1 className="font-display text-3xl text-forest">Join the Fleet</h1>
        <p className="text-sm text-sub mt-1">Driver &amp; owner registration</p>
      </div>

      {step === "phone" ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-sub mb-1">Phone number</label>
            <div className="flex">
              <span className="bg-pale border border-border rounded-l-xl px-3 py-3 text-sm text-sub">+91</span>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="9XXXXXXXXX"
                className="flex-1 border border-l-0 border-border rounded-r-xl px-3 py-3 text-sm outline-none focus:ring-2 ring-leaf/30"
              />
            </div>
          </div>
          <button onClick={handleSendOtp} disabled={loading || phone.length < 10}
            className="w-full bg-leaf text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get OTP"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input type="number" value={otp} onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit OTP"
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />

          <div>
            <label className="block text-xs text-sub mb-1">I am registering as</label>
            <div className="flex gap-2">
              {(["driver", "owner", "both"] as RegType[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors
                    ${type === t ? "bg-leaf text-white border-leaf" : "bg-white text-sub border-border"}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <input type="text" placeholder="Full name"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />

          {needsDriver && (
            <>
              <input type="text" placeholder="License number"
                value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
              <input type="text" placeholder="Vehicle type (e.g. SUV, Sedan)"
                value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
              <input type="text" placeholder="Vehicle number (plate)"
                value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
              <input type="text" placeholder="Vehicle model (e.g. Innova Crysta)"
                value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
            </>
          )}

          {needsOwner && (
            <input type="email" placeholder="Email (optional)"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
          )}

          <button onClick={handleSubmit} disabled={loading || !form.name || !otp}
            className="w-full bg-leaf text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Application"}
          </button>
        </div>
      )}
    </div>
  );
}
