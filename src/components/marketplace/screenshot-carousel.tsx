"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Screenshot {
  id: string;
  url: string;
  altText?: string | null;
}

/**
 * Horizontally-snapping screenshot slider. Scroll-snap (not a drag/physics
 * reimplementation) does the sliding -- it's what gives touch swipe on
 * mobile for free, arrows and dots just call scrollTo/scrollBy on the same
 * track. Falls back to a single static image with no controls when there's
 * only one screenshot (or none), matching the old grid's behavior for that
 * case.
 */
export function ScreenshotCarousel({ images, appName }: { images: Screenshot[]; appName: string }) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);

  const scrollToIndex = React.useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  const handleScroll = React.useCallback(() => {
    const track = trackRef.current;
    if (!track || track.children.length === 0) return;
    const slideWidth = track.clientWidth;
    setIndex(Math.round(track.scrollLeft / slideWidth));
  }, []);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <img
        src={images[0].url}
        alt={images[0].altText ?? appName}
        className="aspect-video w-full rounded-lg border border-border object-cover"
      />
    );
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-lg border border-border"
      >
        {images.map((img) => (
          <img
            key={img.id}
            src={img.url}
            alt={img.altText ?? appName}
            className="aspect-video w-full shrink-0 snap-start object-cover"
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollToIndex(Math.max(0, index - 1))}
        disabled={index === 0}
        aria-label="Previous screenshot"
        className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-sm ring-1 ring-border transition-opacity hover:bg-surface disabled:opacity-0"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollToIndex(Math.min(images.length - 1, index + 1))}
        disabled={index === images.length - 1}
        aria-label="Next screenshot"
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-sm ring-1 ring-border transition-opacity hover:bg-surface disabled:opacity-0"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => scrollToIndex(i)}
            aria-label={`Go to screenshot ${i + 1}`}
            aria-current={i === index}
            className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-accent" : "w-1.5 bg-border hover:bg-muted")}
          />
        ))}
      </div>
    </div>
  );
}
