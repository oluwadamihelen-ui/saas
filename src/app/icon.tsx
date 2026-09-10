import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/// Schoolum favicon — same open-book mark as <Logo>, generated at build
/// time so there's no binary asset to keep in sync with the brand colors.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4f46e5",
          borderRadius: 8,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <path d="M9 21.5V11l7-3 7 3v10.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M13 21.5v-6.2a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v6.2" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
