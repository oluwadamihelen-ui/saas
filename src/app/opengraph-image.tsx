import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #14172b 0%, #1e1b4b 55%, #0d9488 130%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <path d="M9 21.5V11l7-3 7 3v10.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M13 21.5v-6.2a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v6.2" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em" }}>{brand.name}</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em", maxWidth: 900, lineHeight: 1.15 }}>
          {brand.tagline}
        </div>
        <div style={{ marginTop: 24, fontSize: 26, color: "rgba(255,255,255,0.72)", maxWidth: 820 }}>
          {brand.shortTagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
