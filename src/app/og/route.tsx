import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#1b4332",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: "80px",
            fontWeight: "bold",
            color: "#d8f3dc",
            marginBottom: "16px",
            letterSpacing: "-2px",
          }}
        >
          Green
        </div>
        <div style={{ fontSize: "32px", color: "#74c69d", marginBottom: "32px" }}>
          Odisha Hill Routes
        </div>
        <div
          style={{
            fontSize: "22px",
            color: "#95d5b2",
            textAlign: "center",
            maxWidth: "700px",
          }}
        >
          Book intercity rides with verified drivers on Koraput, Jeypore &amp; beyond
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
