"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface JobState {
  id: string;
  status: string;
  errorMessage: string | null;
}

const STORY_STEPS = [
  { key: "QUEUED", label: "Queued for generation" },
  { key: "PROCESSING", label: "Analyzing premise and developing characters" },
  { key: "FINALIZING", label: "Structuring episodes and finalizing the story bible" },
];

const SCRIPT_STEPS = [
  { key: "QUEUED", label: "Queued for generation" },
  { key: "PROCESSING", label: "Breaking the episode into scenes and writing the screenplay" },
];

const CHARACTERS_STEPS = [
  { key: "QUEUED", label: "Queued for generation" },
  { key: "PROCESSING", label: "Reading the screenplay and building the character bible" },
];

const LOCATIONS_STEPS = [
  { key: "QUEUED", label: "Queued for generation" },
  { key: "PROCESSING", label: "Reading the screenplay and building the location bible" },
];

const STORYBOARD_STEPS = [
  { key: "QUEUED", label: "Queued for generation" },
  { key: "PROCESSING", label: "Breaking each scene into cinematic shots" },
];

const STEPS_BY_KIND = {
  story: STORY_STEPS,
  script: SCRIPT_STEPS,
  characters: CHARACTERS_STEPS,
  locations: LOCATIONS_STEPS,
  storyboard: STORYBOARD_STEPS,
} as const;

export type GenerationKind = keyof typeof STEPS_BY_KIND;

const STEP_ORDER = ["QUEUED", "PROCESSING", "PROVIDER_GENERATING", "DOWNLOADING", "VALIDATING", "FINALIZING", "SUCCEEDED"];

function stepGlyph(stepKey: string, currentStatus: string): string {
  const stepIndex = STEP_ORDER.indexOf(stepKey);
  const currentIndex = STEP_ORDER.indexOf(currentStatus);
  if (currentStatus === "SUCCEEDED" || currentIndex > stepIndex) return "✓";
  if (currentIndex === stepIndex) return "●";
  return "○";
}

/**
 * Never-fake progress (spec §54-55): renders whatever GenerationJobStatus
 * the backend actually reports, polling until the job reaches a terminal
 * state. No invented percentage is ever shown.
 */
export function GenerationProgress({ jobId, kind, title }: { jobId: string; kind: GenerationKind; title: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobState | null>(null);
  const steps = STEPS_BY_KIND[kind] ?? STORY_STEPS;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (cancelled) return;
      if (!res.ok) return;
      const data = await res.json();
      setJob(data.job);

      if (data.job.status === "SUCCEEDED") {
        router.refresh();
        return;
      }
      if (data.job.status === "FAILED" || data.job.status === "CANCELLED") return;
      timer = setTimeout(poll, 2500);
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, router]);

  if (!job) return <div className="card animate-pulse text-sm text-cinerra-muted">Connecting…</div>;

  if (job.status === "FAILED") {
    return (
      <div className="card border-red-500/30 bg-red-500/5">
        <p className="font-semibold text-red-300">We couldn&apos;t generate this.</p>
        <p className="mt-1 text-sm text-cinerra-muted">{job.errorMessage ?? "An unexpected error occurred."}</p>
        <p className="mt-3 text-xs text-cinerra-muted">Your project is safe — nothing was lost.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="mb-4 flex items-center gap-2 font-semibold">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cinerra-accent" />
        {title}
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-cinerra-muted">
            <span className="w-4 text-cinerra-accent">{stepGlyph(step.key, job.status)}</span>
            {step.label}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-cinerra-muted">You can navigate away — this keeps generating in the background.</p>
    </div>
  );
}
