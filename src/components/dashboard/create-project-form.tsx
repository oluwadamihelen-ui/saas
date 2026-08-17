"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { VISUAL_STYLES, ASPECT_RATIOS } from "@/lib/style-options";

type Mode = "idea" | "script";

export function CreateProjectForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idea");
  const [style, setStyle] = useState<string>(VISUAL_STYLES[0].value);
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIOS[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      title: form.get("title"),
      description: form.get("description") || undefined,
      idea: mode === "idea" ? form.get("content") || undefined : undefined,
      script: mode === "script" ? form.get("content") || undefined : undefined,
      language: form.get("language") || undefined,
      audience: form.get("audience") || undefined,
      targetLengthSeconds: form.get("targetLength") ? Number(form.get("targetLength")) : undefined,
      aspectRatio,
      visualStyle: style,
    };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create project.");
      }
      const data = await res.json();
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <Card className="p-6">
        <Label htmlFor="title">Video title</Label>
        <Input id="title" name="title" required maxLength={150} placeholder="e.g. Why Our Product Saves You Time" />

        <div className="mt-5">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea id="description" name="description" rows={2} maxLength={2000} placeholder="A short summary of what this video is about" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("idea")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              mode === "idea" ? "bg-brand-500 text-white" : "bg-surface-muted text-muted-foreground"
            )}
          >
            Start with an idea
          </button>
          <button
            type="button"
            onClick={() => setMode("script")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              mode === "script" ? "bg-brand-500 text-white" : "bg-surface-muted text-muted-foreground"
            )}
          >
            Paste a complete script
          </button>
        </div>
        <div className="mt-4">
          <Label htmlFor="content">{mode === "idea" ? "Your idea" : "Your script"}</Label>
          <Textarea
            id="content"
            name="content"
            rows={8}
            maxLength={20000}
            placeholder={
              mode === "idea"
                ? "e.g. A curious fox discovers a glowing forest at night and learns it's protected by tiny guardian spirits."
                : "Paste your full narration script here — Storyloom will break it into scenes."
            }
          />
          <p className="mt-2 text-xs text-muted-foreground">
            AI script generation and file upload are available once your project&apos;s storyboard step is set up.
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-display font-semibold">Video settings</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="language">Language</Label>
            <select id="language" name="language" defaultValue="en" className="h-11 w-full rounded-lg border border-border-strong bg-surface px-3.5 text-sm">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
          <div>
            <Label htmlFor="audience">Target audience</Label>
            <Input id="audience" name="audience" maxLength={100} placeholder="e.g. Small business owners" />
          </div>
          <div>
            <Label htmlFor="targetLength">Target length (seconds)</Label>
            <Input id="targetLength" name="targetLength" type="number" min={10} max={900} placeholder="60" />
          </div>
        </div>

        <div className="mt-6">
          <Label>Aspect ratio</Label>
          <div className="flex gap-3">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.value}
                type="button"
                onClick={() => setAspectRatio(ratio.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4",
                  aspectRatio === ratio.value ? "border-brand-400 bg-brand-50" : "border-border"
                )}
              >
                <div className={cn("rounded bg-gradient-to-br from-brand-300 to-brand-500", ratio.boxClass)} />
                <span className="text-xs font-medium">{ratio.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-display font-semibold">Visual style</h3>
        <p className="mt-1 text-sm text-muted-foreground">Pick the art direction Storyloom will use for every scene.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {VISUAL_STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStyle(s.value)}
              className="group text-left"
            >
              <div
                className={cn(
                  "aspect-square rounded-xl bg-gradient-to-br ring-offset-2 ring-offset-surface",
                  s.gradient,
                  style === s.value ? "ring-2 ring-brand-500" : "ring-0"
                )}
              />
              <p className="mt-1.5 text-xs font-medium">{s.label}</p>
            </button>
          ))}
        </div>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Creating…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
