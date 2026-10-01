import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RiskPilot — Know your risk before you enter the trade", template: "%s · RiskPilot" },
  description: "Position size calculator, trade journal and risk guardrails for retail traders. Risk management and record-keeping — not financial advice.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};
export const viewport: Viewport = { themeColor: "#0a0d13", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
