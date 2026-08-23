"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { EditorScene } from "./types";

const ASPECT_CLASS: Record<string, string> = {
  RATIO_16_9: "aspect-video",
  RATIO_9_16: "aspect-[9/16] max-w-sm mx-auto",
  RATIO_1_1: "aspect-square max-w-lg mx-auto",
};

export function EditorPreview({
  scene,
  aspectRatio,
  sceneIndex,
  sceneCount,
  isPlaying,
  currentTime,
  activeCaptionText,
  muted,
  volume,
  onTogglePlay,
  onPrev,
  onNext,
  onMuteToggle,
  onVolumeChange,
}: {
  scene: EditorScene | undefined;
  aspectRatio: string;
  sceneIndex: number;
  sceneCount: number;
  isPlaying: boolean;
  currentTime: number;
  activeCaptionText: string | null;
  muted: boolean;
  volume: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onMuteToggle: () => void;
  onVolumeChange: (v: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(() => undefined);
    }
  }

  const duration = scene ? scene.voiceDurationSeconds ?? scene.durationSeconds : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden rounded-xl bg-black",
          ASPECT_CLASS[aspectRatio] ?? "aspect-video",
          isFullscreen && "flex items-center justify-center"
        )}
      >
        {scene?.imageUrl ? (
          <Image src={scene.imageUrl} alt={scene.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/50">No visual yet</div>
        )}

        {activeCaptionText && (
          <div className="absolute inset-x-0 bottom-6 flex justify-center px-6">
            <span className="max-w-lg rounded-md bg-black/70 px-3 py-1.5 text-center text-sm font-medium text-white">
              {activeCaptionText}
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
          Scene {sceneIndex + 1} / {sceneCount}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-brand-500 transition-[width]"
            style={{ width: duration > 0 ? `${Math.min(100, (currentTime / duration) * 100)}%` : "0%" }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={onPrev} disabled={sceneIndex === 0} aria-label="Previous scene">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="primary" onClick={onTogglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onNext} disabled={sceneIndex >= sceneCount - 1} aria-label="Next scene">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={onMuteToggle} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-20 accent-brand-500"
              aria-label="Volume"
            />
            <Button size="icon" variant="ghost" onClick={toggleFullscreen} aria-label="Fullscreen">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
