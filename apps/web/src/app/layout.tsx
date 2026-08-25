import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FilmDoe — Create your next movie with AI",
  description: "Turn an idea or screenplay into a cinematic AI movie.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cinerra-bg font-sans text-cinerra-text antialiased">{children}</body>
    </html>
  );
}
