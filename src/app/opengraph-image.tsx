import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Green Rides — Premium intercity cabs in Koraput & Jeypore";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a3d24 0%, #2d6a4f 60%, #52b788 100%)",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* Leaf pattern overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          opacity: 0.06,
          fontSize: 120,
          flexWrap: "wrap",
          overflow: "hidden",
          gap: 40,
          padding: 20,
        }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i}>🍃</span>
          ))}
        </div>

        {/* Logo circle */}
        <div style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          border: "2px solid rgba(210,255,220,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
          fontSize: 52,
        }}>
          🍃
        </div>

        {/* Brand name */}
        <div style={{
          fontSize: 72,
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "-2px",
          lineHeight: 1,
          marginBottom: 16,
        }}>
          Green Rides
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 28,
          color: "rgba(210,255,220,0.75)",
          fontWeight: 400,
          letterSpacing: "0.5px",
          marginBottom: 48,
        }}>
          Premium intercity cabs · Koraput &amp; Jeypore
        </div>

        {/* Route pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {["Koraput → Jeypore", "Jagdalpur → Vizag", "Koraput → Bhubaneswar"].map((route) => (
            <div key={route} style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(210,255,220,0.25)",
              borderRadius: 50,
              padding: "10px 22px",
              fontSize: 18,
              color: "rgba(210,255,220,0.85)",
              fontWeight: 500,
            }}>
              {route}
            </div>
          ))}
        </div>

        {/* Bottom URL */}
        <div style={{
          position: "absolute",
          bottom: 36,
          fontSize: 20,
          color: "rgba(210,255,220,0.45)",
          letterSpacing: "1px",
        }}>
          greenrides.co.in
        </div>
      </div>
    ),
    { ...size }
  );
}
