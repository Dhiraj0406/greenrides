"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Car, Building2, Users, ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type Step = "phone" | "otp" | "role" | "profile";
type RoleType = "driver" | "owner" | "both";

const STEPS: Step[] = ["phone", "otp", "role", "profile"];

export default function FleetRegisterPage() {
  const router = useRouter();

  const [step, setStep]     = useState<Step>("phone");
  const [phone, setPhone]   = useState("");
  const [otp, setOtp]       = useState("");
  const [role, setRole]     = useState<RoleType>("driver");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const tokenRef = useRef("");

  const [form, setForm] = useState({
    name:           "",
    license_number: "",
    vehicle_type:   "",
    vehicle_number: "",
    vehicle_model:  "",
    email:          "",
  });

  // ── Step 1: send OTP ──────────────────────────────────────────────────────
  async function handleSendOtp() {
    if (phone.length < 10) return;
    setLoading(true);
    try {
      const { sendOtp } = await import("@/lib/phone-auth");
      await sendOtp(phone);
      setStep("otp");
      toast.success("OTP sent to +91 " + phone);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP ────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    if (otp.length < 6) return;
    setLoading(true);
    try {
      const { verifyOtp } = await import("@/lib/phone-auth");
      const session = await verifyOtp(phone, otp);
      tokenRef.current = session.access_token;

      // Decode roles from JWT payload (avoids a second round-trip)
      let roles: string[] = [];
      let fleetStatus     = "";
      try {
        // Base64url → Base64 conversion required for standard atob()
        const b64 = session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(b64));
        roles       = (payload.app_metadata?.roles as string[]) ?? [];
        fleetStatus = (payload.app_metadata?.fleet_status as string) ?? "";
      } catch {}

      if (roles.includes("driver") || roles.includes("owner")) {
        // Already registered — go to their home screen
        router.replace("/fleet");
        return;
      }
      if (fleetStatus === "pending") {
        router.replace("/fleet/pending");
        return;
      }

      // New user — continue to onboarding
      setStep("role");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Wrong OTP — please try again");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 4: submit profile ─────────────────────────────────────────────────
  async function handleSubmit() {
    if (!form.name.trim() || !agreed) return;
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/register", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ type: role, phone, ...form }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success("Application submitted!");
      router.replace("/fleet/pending");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const isDriver = role === "driver" || role === "both";
  const isOwner  = role === "owner"  || role === "both";
  const stepIdx  = STEPS.indexOf(step);

  const profileReady =
    form.name.trim().length >= 2 &&
    agreed &&
    (!isDriver || (form.license_number && form.vehicle_type && form.vehicle_number && form.vehicle_model));

  return (
    <div className="green-container min-h-screen bg-cream px-4 py-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-leaf text-xs font-mono-green uppercase tracking-widest mb-1">Green Rides Fleet</p>
        <h1 className="font-display text-3xl text-forest">Join the Fleet</h1>
        <p className="text-sm text-sub mt-1">
          {step === "phone"   && "Enter your mobile number to get started"}
          {step === "otp"     && "Verify your number with the OTP"}
          {step === "role"    && "How will you use the fleet portal?"}
          {step === "profile" && "Almost done — tell us about yourself"}
        </p>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full flex-1 transition-all duration-300 ${
              i <= stepIdx ? "bg-leaf" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* ── Step 1: Phone ─────────────────────────────────────────────────── */}
      {step === "phone" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-sub mb-2">Mobile number</label>
            <div className="flex">
              <span className="bg-pale border border-border rounded-l-xl px-3 flex items-center text-sm text-sub font-medium">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                placeholder="9XXXXXXXXX"
                className="flex-1 border border-l-0 border-border rounded-r-xl px-3 py-3.5 text-sm outline-none focus:ring-2 ring-leaf/30"
                autoFocus
              />
            </div>
          </div>

          <button
            onClick={handleSendOtp}
            disabled={loading || phone.length < 10}
            className="w-full bg-leaf text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><span>Get OTP</span> <ArrowRight className="w-4 h-4" /></>}
          </button>

          <p className="text-center text-xs text-sub pt-2">
            Already registered?{" "}
            <Link href="/fleet/login" className="text-leaf font-semibold">Sign in here</Link>
          </p>
        </div>
      )}

      {/* ── Step 2: OTP ───────────────────────────────────────────────────── */}
      {step === "otp" && (
        <div className="space-y-4">
          <div className="bg-pale rounded-2xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-sub">
              OTP sent to <span className="font-semibold text-text">+91 {phone}</span>
            </p>
            <button
              onClick={() => { setStep("phone"); setOtp(""); }}
              className="text-xs text-leaf font-semibold"
            >
              Change
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-sub mb-2">6-digit OTP</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              placeholder="• • • • • •"
              className="w-full border border-border rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:ring-2 ring-leaf/30"
              autoFocus
            />
          </div>

          <button
            onClick={handleVerifyOtp}
            disabled={loading || otp.length < 6}
            className="w-full bg-leaf text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><span>Verify & Continue</span> <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      )}

      {/* ── Step 3: Role ──────────────────────────────────────────────────── */}
      {step === "role" && (
        <div className="space-y-3">
          {([
            {
              value: "driver" as RoleType,
              icon:  Car,
              title: "Driver",
              desc:  "I drive passengers — intercity cab, tours",
            },
            {
              value: "owner" as RoleType,
              icon:  Building2,
              title: "Fleet Owner",
              desc:  "I own vehicles and manage a team of drivers",
            },
            {
              value: "both" as RoleType,
              icon:  Users,
              title: "Driver & Owner",
              desc:  "I drive and also own vehicles in a fleet",
            },
          ] as const).map(({ value, icon: Icon, title, desc }) => (
            <button
              key={value}
              onClick={() => setRole(value)}
              className={`w-full text-left border-2 rounded-2xl p-4 flex items-center gap-4 transition-colors ${
                role === value ? "border-leaf bg-leaf/5" : "border-border bg-white"
              }`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                role === value ? "bg-leaf/20" : "bg-pale"
              }`}>
                <Icon className={`w-5 h-5 ${role === value ? "text-leaf" : "text-sub"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${role === value ? "text-forest" : "text-text"}`}>{title}</p>
                <p className="text-xs text-sub mt-0.5">{desc}</p>
              </div>
              {role === value && (
                <CheckCircle className="w-5 h-5 text-leaf flex-shrink-0" />
              )}
            </button>
          ))}

          <button
            onClick={() => setStep("profile")}
            className="w-full bg-leaf text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 mt-2"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 4: Profile details ───────────────────────────────────────── */}
      {step === "profile" && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Your full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30"
            autoFocus
          />

          {isDriver && (
            <>
              <input
                type="text"
                placeholder="Driving licence number (e.g. OD0520XXXXXXXX)"
                value={form.license_number}
                onChange={(e) => setForm({ ...form, license_number: e.target.value.toUpperCase() })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30 font-mono"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.vehicle_type}
                  onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                  className="border border-border rounded-xl px-3 py-3 text-sm bg-white outline-none focus:ring-2 ring-leaf/30 text-text"
                >
                  <option value="">Vehicle type</option>
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Hatchback">Hatchback</option>
                  <option value="MUV">MUV / Van</option>
                  <option value="Traveller">Traveller</option>
                </select>
                <input
                  type="text"
                  placeholder="Reg. no. (OD05XX1234)"
                  value={form.vehicle_number}
                  onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                  className="border border-border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 ring-leaf/30 font-mono"
                />
              </div>

              <input
                type="text"
                placeholder="Vehicle model (e.g. Maruti Swift Dzire)"
                value={form.vehicle_model}
                onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30"
              />
            </>
          )}

          {isOwner && (
            <input
              type="email"
              placeholder="Business email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30"
            />
          )}

          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-green-700 flex-shrink-0"
            />
            <span className="text-xs text-sub leading-relaxed">
              I agree to the{" "}
              <a href="/fleet-agreement" target="_blank" className="text-leaf underline">Fleet Agreement</a>,{" "}
              <a href="/terms"           target="_blank" className="text-leaf underline">Terms</a> and{" "}
              <a href="/privacy"         target="_blank" className="text-leaf underline">Privacy Policy</a>
            </span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={loading || !profileReady}
            className="w-full bg-leaf text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Application"}
          </button>

          <button
            onClick={() => setStep("role")}
            className="w-full text-xs text-sub py-2 text-center"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
