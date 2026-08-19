"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type JobRow = { id: string; stage: string; status: string; error: string | null; sceneId: string | null };

const STAGE_LABEL: Record<string, string> = {
  SCRIPT_ANALYSIS: "Analyzing your script",
  STORYBOARD: "Building the storyboard",
  CHARACTER_EXTRACTION: "Identifying characters",
  SCENE_PROMPT: "Writing scene prompts",
  IMAGE: "Generating scene visuals",
  ANIMATION: "Generating animation",
  VOICE: "Generating narration",
  MUSIC: "Generating music",
  CAPTIONS: "Generating captions",
  COMPOSE: "Composing video",
};

export function GenerationTrigger({ projectId, hasContent }: { projectId: string; hasContent: boolean }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function stopPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setPolling(false);
  }

  async function poll() {
    const res = await fetch(`/api/projects/${projectId}/jobs`);
    if (!res.ok) return;
    const data = await res.json();
    setJobs(data.jobs ?? []);

    if (data.project?.status === "STORYBOARD_READY" || data.project?.status === "READY_TO_EDIT") {
      stopPolling();
      router.refresh();
    }
    if (data.jobs?.some((j: JobRow) => j.status === "FAILED")) {
      stopPolling();
    }
  }

  async function onGenerate() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not start generation.");
      }
      setPolling(true);
      intervalRef.current = setInterval(poll, 2000);
      poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStarting(false);
    }
  }

  if (polling) {
    const latestStage = jobs[0];
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="font-display font-semibold">
          {latestStage ? STAGE_LABEL[latestStage.stage] ?? "Working…" : "Preparing…"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This runs in the background — you can leave this page and come back.
        </p>
        {jobs.some((j) => j.status === "FAILED") && (
          <p className="text-sm text-danger">
            {jobs.find((j) => j.status === "FAILED")?.error ?? "Generation failed."}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
        <Sparkles className="h-6 w-6 text-brand-600" />
      </div>
      <p className="font-display font-semibold">
        {hasContent ? "Ready to build your storyboard" : "Add an idea or script to get started"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Storyloom will analyze your story, break it into scenes, identify characters and generate a
        visual for each scene.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={onGenerate} disabled={!hasContent || starting} className="mt-2">
        {starting ? "Starting…" : "Generate Storyboard"}
      </Button>
    </Card>
  );
}
