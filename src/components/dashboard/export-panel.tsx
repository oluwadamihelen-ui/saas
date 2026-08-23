"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Share2, RotateCcw, Film } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type RenderJob = {
  id: string;
  resolution: "R_720P" | "R_1080P";
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  stage: string | null;
  outputUrl: string | null;
  error: string | null;
} | null;

const RESOLUTIONS = [
  { value: "R_1080P" as const, label: "1080p", hint: "Full HD — best quality" },
  { value: "R_720P" as const, label: "720p", hint: "Smaller file, faster render" },
];

export function ExportPanel({ projectId, initialJob }: { projectId: string; initialJob: RenderJob }) {
  const router = useRouter();
  const [job, setJob] = useState<RenderJob>(initialJob);
  const [resolution, setResolution] = useState<"R_720P" | "R_1080P">("R_1080P");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = job?.status === "QUEUED" || job?.status === "PROCESSING";

  useEffect(() => {
    if (isActive && !intervalRef.current) {
      intervalRef.current = setInterval(async () => {
        const res = await fetch(`/api/projects/${projectId}/render`);
        if (!res.ok) return;
        const data = await res.json();
        setJob(data.renderJob);
        if (data.renderJob?.status === "COMPLETED" || data.renderJob?.status === "FAILED") {
          router.refresh();
        }
      }, 2000);
    }
    if (!isActive && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, projectId, router]);

  async function startRender() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start render.");
      setJob(data.renderJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStarting(false);
    }
  }

  async function copyShareLink() {
    if (!job?.outputUrl) return;
    const absolute = job.outputUrl.startsWith("http") ? job.outputUrl : `${window.location.origin}${job.outputUrl}`;
    await navigator.clipboard.writeText(absolute).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (job?.status === "COMPLETED" && job.outputUrl) {
    return (
      <div className="space-y-4">
        <Card className="overflow-hidden p-0">
          <video src={job.outputUrl} controls className="w-full bg-black" />
        </Card>
        <div className="flex flex-wrap gap-2">
          <a
            href={job.outputUrl}
            download
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Download className="h-4 w-4" /> Download
          </a>
          <Button variant="secondary" onClick={copyShareLink}>
            <Share2 className="h-4 w-4" /> {copied ? "Link copied" : "Share"}
          </Button>
          <Button variant="ghost" onClick={() => setJob(null)}>
            <RotateCcw className="h-4 w-4" /> Create another version
          </Button>
        </div>
      </div>
    );
  }

  if (isActive) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Film className="h-8 w-8 animate-pulse text-brand-500" />
        <p className="font-display font-semibold">{job?.stage ?? "Preparing render"}</p>
        <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full bg-brand-500 transition-[width]" style={{ width: `${job?.progress ?? 0}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{job?.progress ?? 0}%</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {job?.status === "FAILED" && (
        <Card className="border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Render failed: {job.error ?? "Unknown error"}
        </Card>
      )}

      <Card className="p-6">
        <p className="text-sm font-semibold">Resolution</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setResolution(r.value)}
              className={cn(
                "rounded-xl border p-4 text-left",
                resolution === r.value ? "border-brand-400 bg-brand-50" : "border-border"
              )}
            >
              <p className="font-display font-semibold">{r.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.hint}</p>
            </button>
          ))}
        </div>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button onClick={startRender} disabled={starting} size="lg">
        {starting ? "Starting…" : "Start Render"}
      </Button>
    </div>
  );
}
