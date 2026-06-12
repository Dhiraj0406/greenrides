"use client";

import { useState, useEffect, useRef } from "react";
import { useBookingStore } from "@/store/booking";
import { DESTINATIONS, DAY_TRIPS, PICKUP_TIMES, fmt, genRef } from "@/data/constants";
import { BookingConfirmSheet } from "@/components/booking/BookingConfirmSheet";
import { SuccessSheet } from "@/components/booking/SuccessSheet";
import { supabase } from "@/lib/supabase";
import type { RouteInfo } from "@/types";

const CITIES = [
  "Koraput","Jeypore","Sunabeda","Rayagada",
  "Nabarangpur","Malkangiri","Jagdalpur","Visakhapatnam",
];

const DAY_GRADIENTS = [
  "linear-gradient(145deg,#d4e8d6,#b6d4bb)",
  "linear-gradient(145deg,#eeddc8,#e2c49e)",
  "linear-gradient(145deg,#c4dced,#a4c8e4)",
  "linear-gradient(145deg,#d0e4f0,#b0d0e8)",
  "linear-gradient(145deg,#cce8d2,#aad4b4)",
];

const todayStr = () => new Date().toISOString().split("T")[0];

const selStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--paper-2)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-md)",
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--ink)",
  outline: "none",
  WebkitAppearance: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a7870' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 34,
  cursor: "pointer",
  transition: "border-color .2s",
  boxSizing: "border-box",
};

const inpStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--paper-2)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-md)",
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--ink)",
  outline: "none",
  transition: "border-color .2s",
  boxSizing: "border-box",
};

const lblStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--ink-3)",
  textTransform: "uppercase",
  letterSpacing: ".07em",
  display: "block",
  marginBottom: 5,
};

interface Props {
  initialRoutes: RouteInfo[];
}

export function HomeContent({ initialRoutes }: Props) {
  const {
    setOrigin, setDestination, setRouteData, setDiscount,
    fareRupees, distanceKm, durationText,
  } = useBookingStore();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserName(
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        ""
      );
      setUserPhone(user.user_metadata?.phone || user.phone || "");
    });
  }, []);

  const [rideType, setRideType]     = useState<"intercity" | "daytrip">("intercity");
  const [from, setFrom]             = useState("Koraput");
  const [to, setTo]                 = useState("");
  const [date, setDate]             = useState(todayStr());
  const [time, setTime]             = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookingRef] = useState(genRef);

  const [allRoutes, setAllRoutes]   = useState<RouteInfo[]>(initialRoutes);
  const loadedCities = useRef(new Set(initialRoutes.map((r) => r.from_city)));

  useEffect(() => {
    if (!from || loadedCities.current.has(from)) return;
    fetch(`/api/routes?origin=${encodeURIComponent(from)}`)
      .then((r) => r.json())
      .then((j: { data?: RouteInfo[] }) => {
        if (j.data?.length) {
          loadedCities.current.add(from);
          setAllRoutes((prev) => [...prev, ...j.data!]);
        }
      })
      .catch(() => {});
  }, [from]);

  useEffect(() => { setOrigin(from); }, [from, setOrigin]);

  useEffect(() => {
    if (!to) { setDestination(""); return; }
    const route = allRoutes.find((r) => r.from_city === from && r.to_city === to);
    if (route) {
      setDestination(route.to_city);
      setRouteData({ km: route.distance_km, min: route.duration_min, text: route.duration_text, fare: route.fare_rupees });
      setDiscount(route.discount_pct ?? 0, route.discount_label ?? "");
    } else {
      const dest = DESTINATIONS.find((d) => d.name === to);
      if (dest) {
        setDestination(dest.name);
        setRouteData({ km: dest.km, min: Math.round(dest.km * 1.8), text: dest.dur, fare: dest.fare });
        setDiscount(0, "");
      }
    }
  }, [to, from, allRoutes, setDestination, setRouteData, setDiscount]);

  const destOptions = allRoutes
    .filter((r) => r.from_city === from)
    .sort((a, b) => a.distance_km - b.distance_km);

  const canBook = !!(from && to && date && time && fareRupees !== null);

  const dispDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short",
      })
    : "";

  const swap = () => {
    const oldFrom = from;
    const oldTo   = to;
    setFrom(oldTo || oldFrom);
    setTo(oldFrom);
  };

  const selectQuickRoute = (name: string) => {
    setRideType("intercity");
    setTo(name);
    setTimeout(() => {
      document.getElementById("booking-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <>
      {/* ── Greeting ──────────────────────────────────────────── */}
      <div style={{ padding: "20px 20px 8px" }}>
        <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>
          Good {greeting}
        </div>
        <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 24, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.3px", marginTop: 2 }}>
          {userName ? `Where to, ${userName.split(" ")[0]}?` : "Where are you headed?"}
        </div>
      </div>

      {/* ── Booking card ──────────────────────────────────────── */}
      <div
        id="booking-card"
        style={{
          margin: "12px 16px 0",
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          overflow: "hidden",
          boxShadow: "var(--sh-lg)",
        }}
      >
        {/* Header with toggle */}
        <div style={{ background: "var(--green)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.7)", letterSpacing: ".03em" }}>
            Book a ride
          </span>
          <div style={{ display: "flex", background: "rgba(255,255,255,.12)", borderRadius: 999, padding: 3 }}>
            {(["intercity", "daytrip"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRideType(t)}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "5px 12px", borderRadius: 999,
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  background: rideType === t ? "rgba(255,255,255,.2)" : "transparent",
                  color: rideType === t ? "#fff" : "rgba(255,255,255,.6)",
                  transition: "all .2s",
                }}
              >
                {t === "intercity" ? "Intercity" : "Day Trip"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px" }}>
          {rideType === "intercity" ? (
            <>
              {/* From / To row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={lblStyle}>From</label>
                  <select
                    value={from}
                    onChange={(e) => { setFrom(e.target.value); setTo(""); }}
                    style={selStyle}
                  >
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <button
                  onClick={swap}
                  style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: "var(--paper-3)", border: "1.5px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, color: "var(--ink-3)", cursor: "pointer",
                    marginTop: 18, transition: "all .28s",
                  }}
                  aria-label="Swap cities"
                >
                  ⇄
                </button>

                <div style={{ flex: 1 }}>
                  <label style={lblStyle}>To</label>
                  <select value={to} onChange={(e) => setTo(e.target.value)} style={selStyle}>
                    <option value="">Select destination</option>
                    {(destOptions.length > 0 ? destOptions : []).map((r) => (
                      <option key={r.to_city} value={r.to_city}>{r.to_city}</option>
                    ))}
                    {destOptions.length === 0 && DESTINATIONS.map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date / Time row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={lblStyle}>Date</label>
                  <input
                    type="date"
                    value={date}
                    min={todayStr()}
                    onChange={(e) => setDate(e.target.value)}
                    style={inpStyle}
                  />
                </div>
                <div>
                  <label style={lblStyle}>Time</label>
                  <select value={time} onChange={(e) => setTime(e.target.value)} style={selStyle}>
                    <option value="">Pick time</option>
                    {PICKUP_TIMES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Fare pill — shown when fare is available */}
              {to && fareRupees !== null && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "var(--green-5)", border: "1.5px solid var(--green-4)",
                  borderRadius: "var(--r-lg)", padding: "14px 18px", marginBottom: 14,
                  animation: "pillIn .25s cubic-bezier(.4,0,.2,1)",
                }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 30, fontWeight: 700, color: "var(--green)", letterSpacing: "-.5px", lineHeight: 1 }}>
                      {fmt(fareRupees)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--green-3)", marginTop: 3 }}>
                      {distanceKm} km · ~{durationText}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ background: "var(--green)", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999 }}>
                      Fixed
                    </div>
                    <div style={{ fontSize: 10, color: "var(--green-3)", marginTop: 4 }}>Toll incl.</div>
                  </div>
                </div>
              )}

              {/* Book button */}
              <button
                disabled={!canBook}
                onClick={() => setShowConfirm(true)}
                style={{
                  width: "100%", height: 50,
                  background: canBook ? "var(--green)" : "var(--ink-5)",
                  color: canBook ? "#fff" : "var(--ink-3)",
                  borderRadius: "var(--r-md)", fontSize: 15, fontWeight: 600,
                  border: "none", cursor: canBook ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: canBook ? "0 3px 14px rgba(26,61,36,.25)" : "none",
                  transition: "all .2s",
                }}
              >
                {canBook ? `Book · ${fmt(fareRupees!)}` : "Fill in route details"}
                {canBook && <span>→</span>}
              </button>
            </>
          ) : (
            /* ── Day Trip list ── */
            <div>
              {DAY_TRIPS.map((t, i) => (
                <a
                  key={t.name}
                  href={`https://wa.me/919668021577?text=${encodeURIComponent(`Hi, I want to book a day trip to ${t.name} from Koraput.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 0",
                    borderBottom: i < DAY_TRIPS.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: "pointer", textDecoration: "none",
                  }}
                >
                  <div style={{ fontSize: 28, width: 44, height: 44, background: "var(--green-5)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {t.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{t.desc}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 17, fontWeight: 700, color: "var(--green)" }}>
                      {fmt(t.fare)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-4)" }}>{t.km} km return</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Popular routes chips ───────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px" }}>
        <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.2px" }}>
          Popular routes
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "0 20px 4px", overflowX: "auto" }}>
        {DESTINATIONS.slice(0, 6).map((r) => (
          <button
            key={r.name}
            onClick={() => selectQuickRoute(r.name)}
            style={{
              flexShrink: 0,
              background: "#fff", border: "1.5px solid var(--border)",
              borderRadius: "var(--r-lg)", padding: "12px 16px",
              cursor: "pointer", transition: "all .2s", minWidth: 120,
              boxShadow: "var(--sh-sm)", textAlign: "left",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.name}</div>
            <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 17, fontWeight: 700, color: "var(--green)", marginTop: 3 }}>
              {fmt(r.fare)}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>{r.km} km</div>
          </button>
        ))}
      </div>

      {/* ── Day trips horizontal scroll ───────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px" }}>
        <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.2px" }}>
          Day trips
        </div>
        <button
          onClick={() => { setRideType("daytrip"); document.getElementById("booking-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          See all
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, padding: "0 20px 4px", overflowX: "auto" }}>
        {DAY_TRIPS.map((t, i) => (
          <a
            key={t.name}
            href={`https://wa.me/919668021577?text=${encodeURIComponent(`Hi, I want to book a day trip to ${t.name} from Koraput.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flexShrink: 0, width: 160, background: "#fff",
              border: "1.5px solid var(--border)", borderRadius: "var(--r-xl)",
              overflow: "hidden", cursor: "pointer", textDecoration: "none",
              boxShadow: "var(--sh-sm)",
            }}
          >
            <div style={{ height: 80, background: DAY_GRADIENTS[i % 5], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, position: "relative" }}>
              {t.emoji}
              <div style={{
                position: "absolute", top: 8, left: 8,
                background: "rgba(255,255,255,.85)", backdropFilter: "blur(4px)",
                fontSize: 8, fontWeight: 700, color: "var(--ink-2)",
                padding: "2px 8px", borderRadius: 999,
                letterSpacing: ".03em", textTransform: "uppercase",
              }}>
                {t.tag}
              </div>
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{t.name}</div>
              <div style={{ fontFamily: "var(--font-display,'Fraunces',serif)", fontSize: 16, fontWeight: 700, color: "var(--green)", marginTop: 2 }}>
                {fmt(t.fare)}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ── Sheets ─────────────────────────────────────────────── */}
      {showConfirm && to && fareRupees !== null && (
        <BookingConfirmSheet
          booking={{
            ref:   bookingRef,
            from,
            to,
            date:  dispDate,
            time,
            fare:  fareRupees,
            km:    distanceKm ?? 0,
            dur:   durationText ?? "",
            name:  userName,
            phone: userPhone,
          }}
          onConfirm={() => { setShowConfirm(false); setShowSuccess(true); }}
          onClose={() => setShowConfirm(false)}
        />
      )}
      {showSuccess && (
        <SuccessSheet bookingRef={bookingRef} onDone={() => setShowSuccess(false)} />
      )}
    </>
  );
}
