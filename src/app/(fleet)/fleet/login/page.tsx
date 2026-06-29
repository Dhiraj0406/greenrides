"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function FleetLoginPage() {
  const router = useRouter();
  const [phone, setPhone]     = useState("");
  const [otp, setOtp]         = useState("");
  const [step, setStep]       = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);

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

  async function handleVerify() {
    if (otp.length < 6) return;
    setLoading(true);
    try {
      const { verifyOtp } = await import("@/lib/phone-auth");
      await verifyOtp(phone, otp);
      // Let fleet index route to today/dashboard based on roles
      router.replace("/fleet");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="green-container min-h-screen bg-cream px-4 py-8">
      <div className="mb-8">
        <p className="text-leaf text-xs font-mono-green uppercase tracking-widest mb-1">Green Rides</p>
        <h1 className="font-display text-3xl text-forest">Fleet Login</h1>
        <p className="text-sm text-sub mt-1">
          {step === "phone" ? "Sign in to your fleet account" : "Enter the OTP sent to your phone"}
        </p>
      </div>

      <div className="space-y-4">
        {step === "phone" ? (
          <>
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get OTP"}
            </button>
          </>
        ) : (
          <>
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
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              placeholder="• • • • • •"
              className="w-full border border-border rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:ring-2 ring-leaf/30"
              autoFocus
            />
            <button
              onClick={handleVerify}
              disabled={loading || otp.length < 6}
              className="w-full bg-leaf text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </button>
          </>
        )}

        <p className="text-center text-xs text-sub pt-2">
          New to Green Rides Fleet?{" "}
          <Link href="/fleet/register" className="text-leaf font-semibold">Register here</Link>
        </p>
      </div>
    </div>
  );
}
