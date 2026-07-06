"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { fmt } from "@/data/constants";
import { Loader2, Phone } from "lucide-react";

const POLL_MS      = 5_000;
const TIMEOUT_MS   = 300_000; // 5 minutes

interface RequestStatus {
  id:           string;
  status:       string;
  from_city:    string;
  to_city:      string;
  fare_paise:   number;
  driver_name:  string | null;
  driver_phone: string | null;
  eta_min:      number | null;
  trip_otp:     string | null;
}

interface Props {
  requestId: string;
  from:      string;
  to:        string;
  fare:      number;
  onDone:    () => void;
}

export function FindingDriverSheet({ requestId, from, to, fare, onDone }: Props) {
  const [req, setReq]         = useState<RequestStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError]     = useState("");
  const tokenRef              = useRef<string>("");
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) tokenRef.current = session.access_token;
    });
  }, []);

  const poll = async () => {
    if (!tokenRef.current) return;
    try {
      const res  = await fetch(`/api/requests/${requestId}`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Request not found"); return; }
      const data: RequestStatus = json.data;
      setReq(data);
      if (data.status === "CONFIRMED" || data.status === "CANCELLED" || data.status === "COMPLETED") {
        clearInterval(intervalRef.current!);
        clearInterval(timerRef.current!);
      }
    } catch {
      // transient network error — keep polling
    }
  };

  useEffect(() => {
    poll(); // immediate first poll
    intervalRef.current = setInterval(poll, POLL_MS);
    timerRef.current    = setInterval(() => setElapsed((e) => e + 1), 1000);

    const timeout = setTimeout(() => {
      clearInterval(intervalRef.current!);
      clearInterval(timerRef.current!);
      setReq((r) => r?.status === "CONFIRMED" ? r : { ...(r as RequestStatus), status: "TIMEOUT" });
    }, TIMEOUT_MS);

    return () => {
      clearInterval(intervalRef.current!);
      clearInterval(timerRef.current!);
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const remaining   = Math.max(0, Math.floor((TIMEOUT_MS / 1000) - elapsed));
  const mins        = Math.floor(remaining / 60);
  const secs        = remaining % 60;
  const progressPct = Math.min(100, (elapsed / (TIMEOUT_MS / 1000)) * 100);
  const status      = req?.status ?? "PENDING";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(17,17,9,.55)", backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%", maxWidth: 420,
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          overflow: "hidden",
          boxShadow: "0 -8px 40px rgba(0,0,0,.18)",
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        {/* ── CONFIRMED / COMPLETED ──────────────────────────── */}
        {(status === "CONFIRMED" || status === "COMPLETED") && req && (
          <>
            <div style={{ background: "var(--green)", padding: "28px 24px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-.3px" }}>
                Driver confirmed!
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginTop: 4 }}>
                {from} → {to} · {fmt(fare)}
              </div>
            </div>

            <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Driver card */}
              <div style={{ background: "var(--green-5)", border: "1.5px solid var(--green-4)", borderRadius: "var(--r-lg)", padding: "16px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 8 }}>Your driver</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {req.driver_name ?? "Driver assigned"}
                </div>
                {req.driver_phone && (
                  <a
                    href={`tel:${req.driver_phone}`}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--green)", textDecoration: "none" }}
                  >
                    <Phone size={14} />
                    +91 {req.driver_phone}
                  </a>
                )}
                {req.eta_min && (
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>
                    ETA: ~{req.eta_min} min
                  </div>
                )}
              </div>

              {/* Trip OTP */}
              {req.trip_otp && (
                <div style={{ background: "var(--paper-2)", border: "1.5px solid var(--border)", borderRadius: "var(--r-lg)", padding: "14px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 6 }}>
                    Show this OTP to your driver at pickup
                  </div>
                  <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 36, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.2em" }}>
                    {req.trip_otp}
                  </div>
                </div>
              )}

              <button
                onClick={onDone}
                style={{
                  width: "100%", height: 50,
                  background: "var(--green)", color: "#fff",
                  borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600,
                  border: "none", cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(26,61,36,.25)",
                }}
              >
                Done
              </button>
            </div>
          </>
        )}

        {/* ── CANCELLED / TIMEOUT ─────────────────────────────── */}
        {(status === "CANCELLED" || status === "TIMEOUT") && (
          <>
            <div style={{ background: "var(--paper-3)", padding: "28px 24px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>😔</div>
              <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.3px" }}>
                No drivers available
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5 }}>
                {status === "TIMEOUT"
                  ? "It's taking longer than usual. Please try again or call us directly."
                  : "All drivers are busy right now. Please try again in a few minutes."}
              </div>
            </div>
            <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href="tel:+919668021577"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  height: 50, background: "var(--green)", color: "#fff",
                  borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Phone size={16} />
                Call +91 96680 21577
              </a>
              <button
                onClick={onDone}
                style={{
                  width: "100%", height: 44,
                  background: "var(--paper-2)", color: "var(--ink-2)",
                  borderRadius: "var(--r-md)", fontSize: 14, fontWeight: 600,
                  border: "1.5px solid var(--border)", cursor: "pointer",
                }}
              >
                Try booking again
              </button>
            </div>
          </>
        )}

        {/* ── SEARCHING (PENDING) ──────────────────────────────── */}
        {status !== "CONFIRMED" && status !== "CANCELLED" && status !== "TIMEOUT" && (
          <>
            {/* Animated header */}
            <div style={{ background: "var(--green)", padding: "28px 24px 20px", position: "relative", overflow: "hidden" }}>
              {/* Pulse rings */}
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    position: "absolute",
                    width: 160 + i * 60, height: 160 + i * 60,
                    borderRadius: "50%",
                    border: "1.5px solid rgba(255,255,255,.12)",
                    top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    animation: `pulse-ring ${1.8 + i * 0.5}s ease-out infinite`,
                    animationDelay: `${i * 0.4}s`,
                  }} />
                ))}
              </div>
              <div style={{ position: "relative", textAlign: "center" }}>
                <div style={{ marginBottom: 12 }}>
                  <Loader2 size={36} style={{ color: "#fff", animation: "spin 1s linear infinite", display: "inline-block" }} />
                </div>
                <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-.2px" }}>
                  Finding your driver…
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", marginTop: 4 }}>
                  {from} → {to} · {fmt(fare)}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 3, background: "var(--paper-3)" }}>
              <div style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "var(--green)",
                transition: "width 1s linear",
              }} />
            </div>

            <div style={{ padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Countdown */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  Driver confirmation window
                </div>
                <div style={{
                  fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
                  fontSize: 18, fontWeight: 600, color: remaining < 60 ? "#e53e3e" : "var(--ink)",
                }}>
                  {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                </div>
              </div>

              {/* Steps */}
              {[
                { label: "Booking created",     done: true },
                { label: "Finding nearby driver", done: elapsed > 5 },
                { label: "Awaiting confirmation", done: false },
              ].map(({ label, done }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: done ? "var(--green)" : "var(--paper-3)",
                    border: done ? "none" : "2px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: "#fff", fontWeight: 700,
                    transition: "all .4s",
                  }}>
                    {done ? "✓" : ""}
                  </div>
                  <div style={{ fontSize: 13, color: done ? "var(--ink)" : "var(--ink-4)", fontWeight: done ? 600 : 400 }}>
                    {label}
                  </div>
                </div>
              ))}

              {error && (
                <div style={{ fontSize: 12, color: "#c53030", background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: "var(--r-md)", padding: "10px 14px" }}>
                  {error}
                </div>
              )}

              {/* Cancel */}
              <button
                onClick={onDone}
                style={{
                  width: "100%", height: 44,
                  background: "var(--paper-2)", color: "var(--ink-3)",
                  borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600,
                  border: "1.5px solid var(--border)", cursor: "pointer",
                  marginTop: 4,
                }}
              >
                Cancel search
              </button>
            </div>
          </>
        )}

        <style>{`
          @keyframes pulse-ring {
            0%   { opacity: .6; transform: translate(-50%,-50%) scale(.6); }
            100% { opacity: 0;  transform: translate(-50%,-50%) scale(1.4); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
