"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { AudioPreviewButton } from "@/components/dashboard/audio-preview-button";
import type { EditorScene, EditorVoice } from "./types";

const STYLE_LABEL: Record<string, string> = {
  WARM: "Warm", ENERGETIC: "Energetic", DRAMATIC: "Dramatic", PROFESSIONAL: "Professional",
  EDUCATIONAL: "Educational", FRIENDLY: "Friendly", STORYTELLING: "Storytelling",
};

export function EditorScenePanel({ scene, voices }: { scene: EditorScene; voices: EditorVoice[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voicePresetId, setVoicePresetId] = useState(scene.voicePresetId ?? "");
  const [speed, setSpeed] = useState(scene.voiceSpeed ?? 1);
  const [pitch, setPitch] = useState(scene.voicePitch ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState({ text: "", startMs: 0, endMs: 1000 });

  const isGeneratingVoice = scene.voiceStatus === "QUEUED" || scene.voiceStatus === "PROCESSING";

  function saveVoiceSettings() {
    startTransition(async () => {
      await fetch(`/api/scenes/${scene.id}/voice-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voicePresetId: voicePresetId || null, voiceSpeed: speed, voicePitch: pitch }),
      });
      router.refresh();
    });
  }

  async function generateVoice() {
    setError(null);
    const res = await fetch(`/api/scenes/${scene.id}/generate-voice`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start narration.");
      return;
    }
    router.refresh();
  }

  async function regenerateCaptions() {
    await fetch(`/api/scenes/${scene.id}/captions/regenerate`, { method: "POST" });
    router.refresh();
  }

  async function addCaption() {
    if (!captionDraft.text.trim()) return;
    await fetch(`/api/scenes/${scene.id}/captions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(captionDraft),
    });
    setCaptionDraft({ text: "", startMs: 0, endMs: 1000 });
    router.refresh();
  }

  async function updateCaption(id: string, data: Partial<{ text: string; startMs: number; endMs: number }>) {
    await fetch(`/api/captions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
  }

  async function deleteCaption(id: string) {
    await fetch(`/api/captions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scene</p>
        <p className="mt-1 truncate font-display text-sm font-semibold">{scene.title}</p>
      </div>

      <div className="space-y-3 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voice</p>
        <div>
          <Label htmlFor="voicePreset">Voice</Label>
          <select
            id="voicePreset"
            value={voicePresetId}
            onChange={(e) => setVoicePresetId(e.target.value)}
            className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm"
          >
            <option value="">Default</option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>{v.name} — {STYLE_LABEL[v.style] ?? v.style}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="speed">Speed ({speed.toFixed(2)}x)</Label>
            <input id="speed" type="range" min={0.5} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-brand-500" />
          </div>
          <div>
            <Label htmlFor="pitch">Pitch ({pitch.toFixed(2)}x)</Label>
            <input id="pitch" type="range" min={0.5} max={2} step={0.05} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} className="w-full accent-brand-500" />
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={saveVoiceSettings} disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save voice settings"}
        </Button>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={generateVoice} disabled={isGeneratingVoice || !scene.narration} className="flex-1">
            <Wand2 className="h-4 w-4" /> {isGeneratingVoice ? "Generating…" : "Generate narration"}
          </Button>
          {scene.voiceUrl && <AudioPreviewButton src={scene.voiceUrl} label="" />}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="space-y-3 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Captions</p>
          <Button size="sm" variant="ghost" onClick={regenerateCaptions} disabled={!scene.narration}>
            <RefreshCw className="h-3.5 w-3.5" /> Auto-generate
          </Button>
        </div>

        <div className="space-y-2">
          {scene.captions.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-2">
              <Textarea
                defaultValue={c.text}
                rows={2}
                className="text-xs"
                onBlur={(e) => e.target.value !== c.text && updateCaption(c.id, { text: e.target.value })}
              />
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number" step={0.1} min={0} defaultValue={(c.startMs / 1000).toFixed(1)}
                  onBlur={(e) => updateCaption(c.id, { startMs: Math.round(Number(e.target.value) * 1000) })}
                  className="h-8 w-16 rounded border border-border-strong px-1.5 text-xs"
                  aria-label="Start (seconds)"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="number" step={0.1} min={0} defaultValue={(c.endMs / 1000).toFixed(1)}
                  onBlur={(e) => updateCaption(c.id, { endMs: Math.round(Number(e.target.value) * 1000) })}
                  className="h-8 w-16 rounded border border-border-strong px-1.5 text-xs"
                  aria-label="End (seconds)"
                />
                <span className="text-xs text-muted-foreground">s</span>
                <Button size="icon" variant="ghost" className="ml-auto h-7 w-7 text-danger" onClick={() => deleteCaption(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-dashed border-border p-2">
          <Textarea
            placeholder="New caption text"
            rows={2}
            className="text-xs"
            value={captionDraft.text}
            onChange={(e) => setCaptionDraft((d) => ({ ...d, text: e.target.value }))}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              type="number" step={0.1} min={0}
              value={captionDraft.startMs / 1000}
              onChange={(e) => setCaptionDraft((d) => ({ ...d, startMs: Math.round(Number(e.target.value) * 1000) }))}
              className="h-8 w-16 text-xs" aria-label="Start (seconds)"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="number" step={0.1} min={0}
              value={captionDraft.endMs / 1000}
              onChange={(e) => setCaptionDraft((d) => ({ ...d, endMs: Math.round(Number(e.target.value) * 1000) }))}
              className="h-8 w-16 text-xs" aria-label="End (seconds)"
            />
            <Button size="sm" variant="secondary" className="ml-auto h-7 px-2" onClick={addCaption}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
