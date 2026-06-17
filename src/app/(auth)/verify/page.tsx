"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

function VerifyForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const phone        = searchParams.get("phone") ?? "";
  const next         = searchParams.get("next") ?? "/";

  const [code, setCode]       = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [countdown, setCountdown] = useState(0);
  const inputs                = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  function handleChange(idx: number, value: string) {
    const digit  = value.replace(/\D/g, "").slice(-1);
    const next_  = [...code];
    next_[idx]   = digit;
    setCode(next_);
    setError("");
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
    if (next_.every((d) => d) && next_.join("").length === 6) {
      verifyOtp(next_.join(""));
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!p) return;
    const arr = p.split("").concat(Array(6).fill("")).slice(0, 6);
    setCode(arr);
    inputs.current[Math.min(p.length, 5)]?.focus();
    if (p.length === 6) verifyOtp(p);
  }

  async function verifyOtp(otp: string) {
    setLoading(true);
    setError("");
    try {
      const phoneNum = phone.replace("+91", "");
      const { verifyOtp: doVerify } = await import("@/lib/phone-auth");
      const session = await doVerify(phoneNum, otp);

      await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});

      const consentValue = sessionStorage.getItem("whatsapp_consent");
      if (consentValue === "1") {
        fetch("/api/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ whatsapp_consent: true }),
        }).catch(() => {});
        sessionStorage.removeItem("whatsapp_consent");
      }

      router.replace(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Try again.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  const displayPhone = phone || "your phone";

  return (
    <div style={{
      minHeight: "100svh", background: "var(--paper)",
      display: "flex", flexDirection: "column",
      maxWidth: 420, margin: "0 auto",
    }}>
      {/* ── Back button ───────────────────────────────────────── */}
      <div style={{ padding: "16px 20px 0" }}>
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}
        >
          <ChevronLeft size={16} /> Back
        </button>
      </div>
      {/* ── Top: logo + heading ───────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "20px 28px 32px",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "var(--green)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20,
          boxShadow: "0 8px 24px rgba(26,61,36,.35)",
        }}>
          <svg viewBox="0 0 24 24" width={26} height={26} fill="none"
               stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2C8 2 4 6 4 10c0 5 8 12 8 12s8-7 8-12c0-4-4-8-8-8z"/>
            <circle cx="12" cy="10" r="2.5" fill="#fff" stroke="none"/>
          </svg>
        </div>
        <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 28, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.5px", marginBottom: 6, textAlign: "center" }}>
          Enter code
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.55 }}>
          6-digit code sent to {displayPhone}
        </div>
      </div>

      {/* ── OTP boxes + actions ───────────────────────────────── */}
      <div style={{ padding: "0 28px 48px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 6-box OTP */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
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
              onPaste={handlePaste}
              style={{
                width: 46, height: 56,
                background: digit ? "var(--green-5)" : "#fff",
                border: `1.5px solid ${digit ? "var(--green-3)" : "var(--border)"}`,
                borderRadius: "var(--r-md)",
                fontSize: 22, fontWeight: 700, color: "var(--ink)",
                textAlign: "center", outline: "none",
                transition: "border-color .2s, background .2s",
                caretColor: "var(--green)",
              }}
            />
          ))}
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#e53e3e", margin: 0, textAlign: "center" }}>{error}</p>
        )}

        <button
          onClick={() => verifyOtp(code.join(""))}
          disabled={loading || code.some((d) => !d)}
          style={{
            width: "100%", height: 52,
            background: "var(--green)", color: "#fff",
            borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600,
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 16px rgba(26,61,36,.28)",
            opacity: loading || code.some((d) => !d) ? 0.45 : 1,
            transition: "opacity .2s",
          }}
        >
          {loading
            ? <Loader2 size={18} className="animate-spin" />
            : "Verify →"}
        </button>

        <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>
          {countdown > 0 ? (
            `Resend in ${countdown}s`
          ) : (
            <>
              Didn&apos;t get it?{" "}
              <button
                onClick={async () => {
                  setCode(["", "", "", "", "", ""]);
                  setCountdown(30);
                  inputs.current[0]?.focus();
                  try {
                    const { sendOtp } = await import("@/lib/phone-auth");
                    await sendOtp(phone.replace("+91", ""));
                  } catch {
                    toast.error("Failed to resend OTP. Please try again.");
                  }
                }}
                style={{ color: "var(--green)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
              >
                Resend OTP
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)" }}>
          <Loader2 className="animate-spin" size={24} style={{ color: "var(--green)" }} />
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
