"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AudioPreviewButton } from "@/components/dashboard/audio-preview-button";
import { cn } from "@/lib/cn";
import type { EditorMusicTrack, EditorProjectMusic } from "./types";

const MOOD_LABEL: Record<string, string> = {
  CINEMATIC: "Cinematic", HAPPY: "Happy", EMOTIONAL: "Emotional", INSPIRATIONAL: "Inspirational",
  SUSPENSE: "Suspense", CALM: "Calm", ADVENTURE: "Adventure", CORPORATE: "Corporate", CHILDRENS: "Children's",
};

export function EditorMusicPanel({
  projectId,
  tracks,
  current,
}: {
  projectId: string;
  tracks: EditorMusicTrack[];
  current: EditorProjectMusic | null;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(current?.musicTrackId ?? "");
  const [volume, setVolume] = useState(current?.volume ?? 0.5);
  const [fadeInMs, setFadeInMs] = useState(current?.fadeInMs ?? 1000);
  const [fadeOutMs, setFadeOutMs] = useState(current?.fadeOutMs ?? 2000);
  const [loop, setLoop] = useState(current?.loop ?? true);
  const [duckUnderVoice, setDuckUnderVoice] = useState(current?.duckUnderVoice ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/music`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ musicTrackId: selectedId, volume, fadeInMs, fadeOutMs, loop, duckUnderVoice }),
    });
    setSaving(false);
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/music`, { method: "DELETE" });
    setSaving(false);
    setSelectedId("");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Background music</p>
        {current && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={remove} disabled={saving} aria-label="Remove music">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {tracks.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedId(t.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(t.id)}
            className={cn(
              "flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-2 text-left",
              selectedId === t.id ? "border-brand-400 bg-brand-50" : "border-border"
            )}
          >
            <span className="text-xs font-medium">{t.name}</span>
            <Badge variant="ember">{MOOD_LABEL[t.mood] ?? t.mood}</Badge>
            {t.url && (
              <div onClick={(e) => e.stopPropagation()}>
                <AudioPreviewButton src={t.url} label="" />
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedId && (
        <div className="space-y-3 border-t border-border pt-3">
          <div>
            <Label htmlFor="volume">Volume ({Math.round(volume * 100)}%)</Label>
            <input id="volume" type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fadeIn">Fade in (s)</Label>
              <input id="fadeIn" type="number" min={0} max={10} step={0.5} value={fadeInMs / 1000} onChange={(e) => setFadeInMs(Math.round(Number(e.target.value) * 1000))} className="h-9 w-full rounded-lg border border-border-strong px-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="fadeOut">Fade out (s)</Label>
              <input id="fadeOut" type="number" min={0} max={10} step={0.5} value={fadeOutMs / 1000} onChange={(e) => setFadeOutMs(Math.round(Number(e.target.value) * 1000))} className="h-9 w-full rounded-lg border border-border-strong px-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={duckUnderVoice} onChange={(e) => setDuckUnderVoice(e.target.checked)} /> Duck under narration
          </label>
          <Button size="sm" onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save music settings"}
          </Button>
        </div>
      )}
    </div>
  );
}
