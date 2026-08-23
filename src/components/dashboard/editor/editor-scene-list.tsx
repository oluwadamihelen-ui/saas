"use client";

import Image from "next/image";
import { Mic, Type } from "lucide-react";
import { cn } from "@/lib/cn";
import type { EditorScene } from "./types";

export function EditorSceneList({
  scenes,
  currentIndex,
  onSelect,
}: {
  scenes: EditorScene[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-xl border border-border bg-surface p-2">
      <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scenes</p>
      <div className="flex flex-col gap-1">
        {scenes.map((scene, i) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg p-2 text-left transition-colors",
              i === currentIndex ? "bg-brand-100" : "hover:bg-surface-muted"
            )}
          >
            <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded bg-surface-muted">
              {scene.imageUrl && <Image src={scene.imageUrl} alt="" fill className="object-cover" unoptimized />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{i + 1}. {scene.title}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                {scene.voiceUrl && <Mic className="h-3 w-3" />}
                {scene.captions.length > 0 && <Type className="h-3 w-3" />}
                <span>{Math.round(scene.voiceDurationSeconds ?? scene.durationSeconds)}s</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
