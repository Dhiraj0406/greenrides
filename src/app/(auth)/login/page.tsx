"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Leaf, Loader2, ArrowLeft, Lock } from "lucide-react";

const STORAGE_KEY = "green_admin_token";

function LoginForm() {
  const router            = useRouter();
  const searchParams      = useSearchParams();
  const next              = searchParams.get("next") ?? "/";
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);

  // Admin bypass state (only shown for ADMIN_PHONE)
  const [adminPin, setAdminPin] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [showAdminOption, setShowAdminOption] = useState(false);

  async function handleSendOtp() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await import("@/lib/supabase").then(
        (m) => m.supabase.auth.signInWithOtp({ phone: `+91${cleaned}` })
      );
      if (authError) {
        // If SMS provider isn't configured, reveal admin bypass option
        if (authError.code === "phone_provider_disabled") {
          setShowAdminOption(true);
          setAdminMode(true);
          setError("SMS not available — use admin login below.");
        } else {
          throw authError;
        }
        return;
      }
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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: adminPin.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Wrong PIN");

      sessionStorage.setItem(STORAGE_KEY, json.token);
      // Cookie lets proxy.ts bypass the Supabase session check for admin
      document.cookie = `green_admin_token=${json.token}; path=/; max-age=86400; SameSite=Strict`;

      // Establish Supabase session so the booking / rider flows also work
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

  return (
    <div className="green-container min-h-screen bg-forest flex flex-col">
      {/* Back link */}
      <div className="px-6 pt-safe-top pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-lime/70 text-sm hover:text-lime transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse routes
        </Link>
      </div>

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

        {/* Phone input */}
        <div className="flex items-center gap-2 bg-warm rounded-xl px-4 py-3.5 mb-3">
          <span className="text-sm text-sub font-mono-green">+91</span>
          <div className="w-px h-4 bg-border" />
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 10);
              setPhone(val);
              setError("");
              setAdminMode(false);
              setAdminPin("");
              setShowAdminOption(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && !adminMode && handleSendOtp()}
            placeholder="98765 43210"
            className="flex-1 bg-transparent text-sm text-text placeholder:text-sub/50
                       outline-none font-mono-green tracking-widest"
          />
        </div>

        {/* Admin bypass — only shown for the admin phone number */}
        {showAdminOption && (
          <button
            type="button"
            onClick={() => { setAdminMode(!adminMode); setError(""); }}
            className="flex items-center gap-1.5 text-xs text-leaf font-semibold mb-3"
          >
            <Lock className="w-3 h-3" />
            {adminMode ? "Use OTP instead" : "Admin login (bypass OTP)"}
          </button>
        )}

        {/* Admin PIN field */}
        {showAdminOption && adminMode && (
          <div className="mb-3">
            <input
              type="password"
              value={adminPin}
              onChange={(e) => { setAdminPin(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
              placeholder="Admin PIN"
              className="w-full bg-warm border border-border rounded-xl px-4 py-3.5 text-sm
                         text-text outline-none focus:border-leaf focus:ring-1 focus:ring-leaf/30"
            />
          </div>
        )}

        {!adminMode && (
          <label className="flex items-start gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                sessionStorage.setItem("whatsapp_consent", e.target.checked ? "1" : "0");
              }}
              className="mt-0.5 w-4 h-4 accent-leaf flex-shrink-0"
            />
            <span className="text-xs text-sub leading-relaxed">
              I agree to receive ride updates and confirmations via WhatsApp (optional)
            </span>
          </label>
        )}

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        <button
          onClick={adminMode ? handleAdminLogin : handleSendOtp}
          disabled={loading || phone.length !== 10 || (adminMode && !adminPin.trim())}
          className="w-full bg-leaf disabled:opacity-50 text-white font-semibold
                     py-4 rounded-xl touch-target flex items-center justify-center
                     gap-2 transition-colors hover:bg-leaf/90"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : adminMode ? (
            "Enter Admin Dashboard →"
          ) : (
            "Send OTP →"
          )}
        </button>

        <p className="text-xs text-sub text-center mt-4">
          By signing in you agree to our{" "}
          <Link href="/terms" className="underline text-leaf/80">terms of service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline text-leaf/80">privacy policy</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="green-container min-h-screen bg-forest flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-lime" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
