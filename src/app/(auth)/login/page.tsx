"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router            = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendOtp() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await import("@/lib/supabase").then(
        (m) => m.supabase.auth.signInWithOtp({ phone: `+91${cleaned}` })
      );
      if (authError) throw authError;
      router.push(`/verify?phone=%2B91${cleaned}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="green-container min-h-screen bg-forest flex flex-col">
      {/* Brand */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="w-16 h-16 rounded-2xl bg-leaf flex items-center justify-center mb-4">
          <Leaf className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-display text-4xl text-lime text-center">Green</h1>
        <p className="text-lime/60 text-sm text-center mt-1">
          Odisha's premium hill route rides
        </p>
      </div>

      {/* Login card */}
      <div className="bg-cream rounded-t-3xl px-6 pt-8 pb-safe-bottom pb-10">
        <h2 className="font-display text-2xl text-text mb-1">Sign in</h2>
        <p className="text-sub text-sm mb-6">
          We'll send a one-time code to your phone
        </p>

        <div className="flex items-center gap-2 bg-warm rounded-xl px-4 py-3.5 mb-4">
          <span className="text-sm text-sub font-mono-green">+91</span>
          <div className="w-px h-4 bg-border" />
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
            placeholder="98765 43210"
            className="flex-1 bg-transparent text-sm text-text placeholder:text-sub/50
                       outline-none font-mono-green tracking-widest"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        <button
          onClick={handleSendOtp}
          disabled={loading || phone.length !== 10}
          className="w-full bg-leaf disabled:opacity-50 text-white font-semibold
                     py-4 rounded-xl touch-target flex items-center justify-center
                     gap-2 transition-colors hover:bg-leaf/90"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Send OTP →"
          )}
        </button>

        <p className="text-xs text-sub text-center mt-4">
          By signing in you agree to our terms of service
        </p>
      </div>
    </div>
  );
}
