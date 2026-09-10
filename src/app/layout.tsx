import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { brand } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/// APP_URL is expected to be a full absolute URL (e.g. "https://app.example.com"),
/// but an environment misconfiguration — unset, blank, or missing the
/// protocol — is a deploy-time footgun: `new URL()` throws on any of those,
/// which fails the entire build rather than just degrading metadataBase.
/// Falling back to localhost keeps a bad value from taking down the build.
function resolveMetadataBase(): URL {
  const raw = process.env.APP_URL;
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      console.warn(`APP_URL is set but not a valid absolute URL ("${raw}") — falling back to http://localhost:3001.`);
    }
  }
  return new URL("http://localhost:3001");
}

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — Intelligent School Management Platform`,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  metadataBase: resolveMetadataBase(),
  openGraph: {
    title: `${brand.name} — Intelligent School Management Platform`,
    description: brand.description,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} — Intelligent School Management Platform`,
    description: brand.description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
