"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import type { EditorScene } from "./types";

const PIXELS_PER_SECOND = 18;
const MIN_BLOCK_WIDTH = 64;

export function EditorTimeline({
  scenes,
  currentIndex,
  currentSceneElapsed,
  onSelect,
}: {
  scenes: EditorScene[];
  currentIndex: number;
  currentSceneElapsed: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface p-3">
      <div className="flex min-w-max items-stretch gap-1.5">
        {scenes.map((scene, i) => {
          const effectiveDuration = scene.voiceDurationSeconds ?? scene.durationSeconds;
          const width = Math.max(MIN_BLOCK_WIDTH, effectiveDuration * PIXELS_PER_SECOND);
          const isCurrent = i === currentIndex;
          const progress = isCurrent ? Math.min(1, currentSceneElapsed / effectiveDuration) : 0;

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(i)}
              style={{ width }}
              className={cn(
                "group relative flex shrink-0 flex-col overflow-hidden rounded-lg border text-left transition-colors",
                isCurrent ? "border-brand-500" : "border-border hover:border-brand-300"
              )}
            >
              <div className="relative h-12 bg-surface-muted">
                {scene.imageUrl && (
                  <Image src={scene.imageUrl} alt="" fill className="object-cover" unoptimized />
                )}
                {isCurrent && (
                  <div className="absolute inset-y-0 left-0 bg-brand-500/30" style={{ width: `${progress * 100}%` }} />
                )}
              </div>
              <div className="flex items-center justify-between gap-1 bg-surface px-1.5 py-1">
                <span className="truncate text-[10px] font-medium">{i + 1}. {scene.title}</span>
              </div>
              <div className="flex gap-0.5 px-1.5 pb-1">
                {scene.voiceUrl && <span className="h-1 flex-1 rounded-full bg-brand-400" title="Voice" />}
                {scene.captions.length > 0 && <span className="h-1 flex-1 rounded-full bg-ember-400" title="Captions" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
