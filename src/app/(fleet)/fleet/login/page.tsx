"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function FleetLoginPage() {
  const router  = useRouter();
  const [phone, setPhone]   = useState("");
  const [otp, setOtp]       = useState("");
  const [step, setStep]     = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    setLoading(true);
    try {
      const { sendOtp } = await import("@/lib/phone-auth");
      await sendOtp(phone);
      setStep("otp");
      toast.success("OTP sent (or enter your test OTP)");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    try {
      const { verifyOtp } = await import("@/lib/phone-auth");
      await verifyOtp(phone, otp);
      router.replace("/");
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
        <p className="text-sm text-sub mt-1">Sign in to your fleet account</p>
      </div>

      <div className="space-y-4">
        {step === "phone" ? (
          <>
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
          </>
        ) : (
          <>
            <input type="number" value={otp} onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit OTP"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30" />
            <button onClick={handleVerify} disabled={loading || otp.length < 6}
              className="w-full bg-leaf text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </button>
          </>
        )}

        <p className="text-center text-xs text-sub">
          New to Green Rides Fleet?{" "}
          <a href="/register" className="text-leaf font-semibold">Register here</a>
        </p>
      </div>
    </div>
  );
}
