"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Leaf, Loader2, ChevronLeft } from "lucide-react";

function VerifyForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const phone        = searchParams.get("phone") ?? "";
  const next         = searchParams.get("next") ?? "/";

  const [code, setCode]       = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const inputs                = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  function handleChange(idx: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next  = [...code];
    next[idx]   = digit;
    setCode(next);
    setError("");
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 6) {
      verifyOtp(next.join(""));
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  async function verifyOtp(otp: string) {
    setLoading(true);
    setError("");

    try {
      const { supabase } = await import("@/lib/supabase");
      const { error: authError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type:  "sms",
      });
      if (authError) throw authError;
      router.replace(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Try again.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="green-container min-h-screen bg-cream flex flex-col">
      <div className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-lime/70 text-sm mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2 mb-4">
            <Leaf className="w-5 h-5 text-lime" />
            <span className="font-display text-xl text-lime">Green</span>
          </div>
          <h1 className="font-display text-3xl text-white">Enter code</h1>
          <p className="text-lime/60 text-sm mt-1">
            Sent to {phone || "your phone"}
          </p>
        </div>
      </div>

      <div className="flex-1 px-6 pt-8">
        <div className="flex gap-3 justify-center mb-6">
          {code.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => { inputs.current[idx] = el; }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="w-12 h-14 rounded-xl border-2 text-center text-xl
                         font-mono-green font-bold text-text outline-none
                         transition-colors border-border focus:border-leaf bg-white"
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-500 text-center mb-4">{error}</p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-leaf" />
          </div>
        )}

        <button
          onClick={() => verifyOtp(code.join(""))}
          disabled={loading || code.some((d) => !d)}
          className="w-full bg-leaf disabled:opacity-50 text-white font-semibold
                     py-4 rounded-xl touch-target flex items-center justify-center
                     transition-colors hover:bg-leaf/90"
        >
          Verify →
        </button>

        <p className="text-xs text-sub text-center mt-4">
          Didn't receive it?{" "}
          <button
            onClick={() => router.replace(`/login?next=${encodeURIComponent(next)}`)}
            className="text-leaf font-semibold"
          >
            Resend
          </button>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="green-container min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}
