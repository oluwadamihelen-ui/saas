"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/// Fades a section up into place the first time it scrolls into view.
/// `.reveal`/`.reveal-visible` (globals.css) do the actual animating —
/// this only toggles the class once, via IntersectionObserver, and never
/// re-hides on scroll-out. Both classes are inert under
/// prefers-reduced-motion, so no separate check is needed here.
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);

    // Safety net: never leave content permanently invisible. A tool that
    // captures/prints the page without genuinely scrolling it (full-page
    // screenshot, PDF export, some crawlers) never fires the observer at
    // all — this guarantees every section still resolves to visible
    // shortly after mount either way.
    const fallback = window.setTimeout(() => setVisible(true), 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", visible && "reveal-visible", className)}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
