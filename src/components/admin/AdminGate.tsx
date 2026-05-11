"use client";

import { ReactNode, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";

const STORAGE_KEY = "green_admin_token";

interface Props {
  children: (token: string) => ReactNode;
}

export function AdminGate({ children }: Props) {
  const [token, setToken]     = useState<string | null>(null);
  const [pin, setPin]         = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setToken(stored);
    setLoading(false);
  }, []);

  async function handleLogin() {
    if (!pin.trim()) return;
    setChecking(true);
    setError("");

    try {
      const res  = await fetch("/api/admin/auth", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Wrong PIN");
      sessionStorage.setItem(STORAGE_KEY, json.token);
      setToken(json.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8">
          <div className="w-12 h-12 rounded-2xl bg-leaf/10 flex items-center justify-center mb-5">
            <Lock className="w-6 h-6 text-leaf" />
          </div>
          <h1 className="font-display text-2xl text-forest mb-1">Admin Access</h1>
          <p className="text-sub text-sm mb-6">Enter your admin PIN to continue</p>

          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Admin PIN"
            className="w-full bg-warm border border-border rounded-xl px-4 py-3 text-sm
                       text-text outline-none focus:border-leaf focus:ring-1 focus:ring-leaf/30 mb-3"
          />

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={checking || !pin.trim()}
            className="w-full bg-leaf disabled:opacity-50 text-white font-semibold
                       py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter Dashboard →"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children(token)}</>;
}
