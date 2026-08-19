"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Pencil, Trash2, Copy, RefreshCw, ChevronUp, ChevronDown, Loader2, Clock, Users2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label } from "@/components/ui/input";

export type SceneData = {
  id: string;
  order: number;
  title: string;
  narration: string | null;
  visualPrompt: string | null;
  location: string | null;
  camera: string | null;
  transition: string | null;
  durationSeconds: number;
  imageUrl: string | null;
  imageStatus: string;
  characters: { character: { id: string; name: string } }[];
};

export function SceneCard({
  scene,
  isFirst,
  isLast,
  onChanged,
}: {
  scene: SceneData;
  isFirst: boolean;
  isLast: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: string, fn: () => Promise<Response>) {
    setBusy(action);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong.");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await call("save", () =>
      fetch(`/api/scenes/${scene.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          narration: form.get("narration"),
          visualPrompt: form.get("visualPrompt"),
          location: form.get("location"),
          camera: form.get("camera"),
          transition: form.get("transition"),
          durationSeconds: Number(form.get("durationSeconds")),
        }),
      })
    );
    setEditing(false);
  }

  const isGenerating = scene.imageStatus === "QUEUED" || scene.imageStatus === "PROCESSING";

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative aspect-video bg-surface-muted">
        {scene.imageUrl ? (
          <Image src={scene.imageUrl} alt={scene.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {isGenerating ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="text-xs">No image yet</span>}
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1.5">
          <Badge variant="neutral">Scene {scene.order + 1}</Badge>
          {isGenerating && <Badge variant="warning">Generating</Badge>}
          {scene.imageStatus === "FAILED" && <Badge variant="danger">Failed</Badge>}
        </div>
      </div>

      <div className="p-4">
        {editing ? (
          <form onSubmit={onSaveEdit} className="space-y-3">
            <div>
              <Label htmlFor={`title-${scene.id}`}>Title</Label>
              <Input id={`title-${scene.id}`} name="title" defaultValue={scene.title} maxLength={150} />
            </div>
            <div>
              <Label htmlFor={`narration-${scene.id}`}>Narration</Label>
              <Textarea id={`narration-${scene.id}`} name="narration" defaultValue={scene.narration ?? ""} rows={2} maxLength={4000} />
            </div>
            <div>
              <Label htmlFor={`visualPrompt-${scene.id}`}>Visual description</Label>
              <Textarea id={`visualPrompt-${scene.id}`} name="visualPrompt" defaultValue={scene.visualPrompt ?? ""} rows={2} maxLength={2000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`location-${scene.id}`}>Location</Label>
                <Input id={`location-${scene.id}`} name="location" defaultValue={scene.location ?? ""} maxLength={150} />
              </div>
              <div>
                <Label htmlFor={`camera-${scene.id}`}>Camera</Label>
                <Input id={`camera-${scene.id}`} name="camera" defaultValue={scene.camera ?? ""} maxLength={150} />
              </div>
              <div>
                <Label htmlFor={`transition-${scene.id}`}>Transition</Label>
                <Input id={`transition-${scene.id}`} name="transition" defaultValue={scene.transition ?? ""} maxLength={50} />
              </div>
              <div>
                <Label htmlFor={`durationSeconds-${scene.id}`}>Duration (s)</Label>
                <Input id={`durationSeconds-${scene.id}`} name="durationSeconds" type="number" min={1} max={120} defaultValue={scene.durationSeconds} />
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="font-display text-sm font-semibold">{scene.title}</h3>
            {scene.narration && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{scene.narration}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {scene.durationSeconds}s</span>
              {scene.characters.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users2 className="h-3 w-3" /> {scene.characters.map((c) => c.character.name).join(", ")}
                </span>
              )}
            </div>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)} aria-label="Edit scene">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-8 w-8"
                onClick={() => call("duplicate", () => fetch(`/api/scenes/${scene.id}/duplicate`, { method: "POST" }))}
                disabled={busy === "duplicate"} aria-label="Duplicate scene"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-8 w-8"
                onClick={() => call("regenerate", () => fetch(`/api/scenes/${scene.id}/regenerate`, { method: "POST" }))}
                disabled={busy === "regenerate" || isGenerating} aria-label="Regenerate visual"
              >
                <RefreshCw className={`h-4 w-4 ${busy === "regenerate" ? "animate-spin" : ""}`} />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-8 w-8"
                disabled={isFirst || busy === "moveUp"}
                onClick={() => call("moveUp", () => fetch(`/api/scenes/${scene.id}/move`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: "up" }) }))}
                aria-label="Move scene up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-8 w-8"
                disabled={isLast || busy === "moveDown"}
                onClick={() => call("moveDown", () => fetch(`/api/scenes/${scene.id}/move`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: "down" }) }))}
                aria-label="Move scene down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="ml-auto h-8 w-8 text-danger hover:bg-danger/10"
                onClick={() => call("delete", () => fetch(`/api/scenes/${scene.id}`, { method: "DELETE" }))}
                disabled={busy === "delete"} aria-label="Delete scene"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
