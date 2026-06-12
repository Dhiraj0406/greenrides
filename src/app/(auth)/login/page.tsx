"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";

const STORAGE_KEY = "green_admin_token";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") ?? "/";

  const [phone, setPhone]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [consent, setConsent]           = useState(false);
  const [adminPin, setAdminPin]         = useState("");
  const [adminMode, setAdminMode]       = useState(false);
  const [showAdminOption, setShowAdminOption] = useState(false);

  async function handleSendOtp() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) { setError("Enter a valid 10-digit mobile number"); return; }
    setLoading(true);
    setError("");
    try {
      const { sendOtp } = await import("@/lib/phone-auth");
      await sendOtp(cleaned);
      router.push(`/verify?phone=%2B91${cleaned}&next=${encodeURIComponent(next)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin() {
    if (!adminPin.trim()) { setError("Enter admin PIN"); return; }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: adminPin.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Wrong PIN");

      sessionStorage.setItem(STORAGE_KEY, json.token);
      document.cookie = `green_admin_token=${json.token}; path=/; max-age=86400; SameSite=Strict`;

      if (json.session) {
        const { supabase: sb } = await import("@/lib/supabase");
        const { error: sessionErr } = await sb.auth.setSession({
          access_token:  json.session.access_token,
          refresh_token: json.session.refresh_token,
        });
        if (!sessionErr) {
          const { data: { session: adminSession } } = await sb.auth.getSession();
          if (adminSession?.access_token) {
            await fetch("/api/users/me", {
              headers: { Authorization: `Bearer ${adminSession.access_token}` },
            }).catch(() => {});
          }
        }
      }
      router.replace(next.startsWith("/") ? next : "/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  const canSend = phone.length === 10 && !loading;

  return (
    <div style={{
      minHeight: "100svh", background: "var(--paper)",
      display: "flex", flexDirection: "column",
      maxWidth: 420, margin: "0 auto",
    }}>
      {/* ── Logo + Brand ──────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 28px 32px",
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
        <div style={{
          fontFamily: "var(--font-display,'Fraunces',serif)",
          fontSize: 28, fontWeight: 700, color: "var(--ink)",
          letterSpacing: "-.5px", marginBottom: 6, textAlign: "center",
        }}>
          Green
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.55 }}>
          Premium hill rides across Koraput,<br />Jeypore &amp; Odisha&apos;s hill towns
        </div>
      </div>

      {/* ── Form ──────────────────────────────────────────────── */}
      <div style={{ padding: "0 28px 48px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Admin toggle (hidden until showAdminOption) */}
        {showAdminOption && (
          <button
            type="button"
            onClick={() => { setAdminMode(!adminMode); setError(""); }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: 4 }}
          >
            <Lock size={12} />
            {adminMode ? "Use OTP instead" : "Admin login (bypass OTP)"}
          </button>
        )}

        {!adminMode ? (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
                Mobile number
              </div>
              {/* Phone input with +91 prefix */}
              <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1.5px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", transition: "border-color .2s" }}>
                <div style={{ padding: "0 14px", fontSize: 15, fontWeight: 500, color: "var(--ink-3)", borderRight: "1.5px solid var(--border)", height: 52, display: "flex", alignItems: "center", background: "var(--paper-2)", flexShrink: 0 }}>
                  +91
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(val);
                    setError("");
                    setAdminMode(false);
                    setAdminPin("");
                    setShowAdminOption(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && canSend && handleSendOtp()}
                  style={{ flex: 1, padding: "0 16px", height: 52, fontSize: 16, fontWeight: 500, color: "var(--ink)", background: "transparent", border: "none", outline: "none", letterSpacing: ".5px" }}
                />
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  sessionStorage.setItem("whatsapp_consent", e.target.checked ? "1" : "0");
                }}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--green)", flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
                I agree to receive ride updates and confirmations via WhatsApp (optional)
              </span>
            </label>

            {error && <p style={{ fontSize: 12, color: "#e53e3e", margin: 0 }}>{error}</p>}

            <button
              onClick={handleSendOtp}
              disabled={!canSend}
              style={{
                width: "100%", height: 52,
                background: "var(--green)", color: "#fff",
                borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600,
                border: "none", cursor: canSend ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 16px rgba(26,61,36,.28)",
                opacity: canSend ? 1 : 0.45,
                transition: "opacity .2s",
              }}
            >
              {loading
                ? <Loader2 size={18} className="animate-spin" />
                : "Send OTP →"}
            </button>
          </>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
                Admin PIN
              </div>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => { setAdminPin(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                placeholder="Enter admin PIN"
                style={{ width: "100%", background: "#fff", border: "1.5px solid var(--border)", borderRadius: "var(--r-md)", padding: "14px 16px", fontSize: 15, color: "var(--ink)", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {error && <p style={{ fontSize: 12, color: "#e53e3e", margin: 0 }}>{error}</p>}
            <button
              onClick={handleAdminLogin}
              disabled={!adminPin.trim() || loading}
              style={{
                width: "100%", height: 52,
                background: "var(--green)", color: "#fff",
                borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600,
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 16px rgba(26,61,36,.28)",
                opacity: !adminPin.trim() || loading ? 0.45 : 1,
                transition: "opacity .2s",
              }}
            >
              {loading
                ? <Loader2 size={18} className="animate-spin" />
                : "Enter Admin Dashboard →"}
            </button>
          </>
        )}

        <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.5 }}>
          By signing in you agree to our{" "}
          <Link href="/terms" style={{ color: "var(--green)", textDecoration: "underline" }}>
            terms of service
          </Link>{" "}
          &amp;{" "}
          <Link href="/privacy" style={{ color: "var(--green)", textDecoration: "underline" }}>
            privacy policy
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)" }}>
          <Loader2 className="animate-spin" size={24} style={{ color: "var(--green)" }} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
