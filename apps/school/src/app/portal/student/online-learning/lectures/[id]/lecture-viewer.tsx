"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/online-learning/progress-bar";
import { markLectureOpenedAction, updateVideoProgressAction, markLectureCompleteManuallyAction } from "../../actions";

interface Resource {
  id: string;
  type: "VIDEO" | "AUDIO" | "WRITTEN" | "PDF" | "WORD_DOCUMENT" | "PRESENTATION" | "IMAGE" | "EXTERNAL_LINK";
  title: string;
  description: string | null;
  fileUrl: string | null;
  externalUrl: string | null;
  writtenContent: string | null;
}

const PROGRESS_SAVE_INTERVAL_MS = 10_000;

export function LectureViewer({
  lectureId,
  resources,
  initialStatus,
  initialPositionSeconds,
}: {
  lectureId: string;
  resources: Resource[];
  initialStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  initialPositionSeconds: number;
}) {
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState(initialStatus);
  const [watchPercent, setWatchPercent] = useState(initialStatus === "COMPLETED" ? 100 : 0);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const lastSavedRef = useRef(0);

  const primaryMedia = resources.find((r) => r.type === "VIDEO" || r.type === "AUDIO");

  useEffect(() => {
    startTransition(() => {
      markLectureOpenedAction(lectureId);
    });
    // Only run once on mount — this records "the student opened this
    // lecture", not something that should re-fire on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveProgress(force = false) {
    const el = mediaRef.current;
    if (!el || !el.duration || Number.isNaN(el.duration)) return;
    const percent = Math.min(100, Math.round((el.currentTime / el.duration) * 100));
    setWatchPercent(percent);
    if (percent >= 80) setStatus("COMPLETED");
    else setStatus("IN_PROGRESS");

    const now = Date.now();
    if (!force && now - lastSavedRef.current < PROGRESS_SAVE_INTERVAL_MS) return;
    lastSavedRef.current = now;
    startTransition(() => {
      updateVideoProgressAction(lectureId, el.currentTime, el.duration);
    });
  }

  function handleLoadedMetadata() {
    const el = mediaRef.current;
    if (el && initialPositionSeconds > 0 && initialPositionSeconds < el.duration - 5) {
      el.currentTime = initialPositionSeconds;
    }
  }

  function markComplete() {
    startTransition(() => {
      markLectureCompleteManuallyAction(lectureId);
    });
    setStatus("COMPLETED");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {primaryMedia?.fileUrl && (
        <div className="space-y-2">
          {primaryMedia.type === "VIDEO" ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={`/api/online-learning/lecture-resources/${primaryMedia.id}`}
              controls
              className="w-full rounded-md border border-border bg-black"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={() => saveProgress()}
              onPause={() => saveProgress(true)}
              onEnded={() => saveProgress(true)}
            />
          ) : (
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={`/api/online-learning/lecture-resources/${primaryMedia.id}`}
              controls
              className="w-full"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={() => saveProgress()}
              onPause={() => saveProgress(true)}
              onEnded={() => saveProgress(true)}
            />
          )}
        </div>
      )}

      {resources
        .filter((r) => r.type === "WRITTEN")
        .map((r) => (
          <div key={r.id} className="whitespace-pre-wrap rounded-md border border-border p-4 text-sm text-foreground">
            {r.writtenContent}
          </div>
        ))}

      {resources.filter((r) => r !== primaryMedia && r.type !== "WRITTEN").length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Learning materials</p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {resources
              .filter((r) => r !== primaryMedia && r.type !== "WRITTEN")
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="text-foreground">{r.title}</span>
                  <a
                    href={r.type === "EXTERNAL_LINK" ? r.externalUrl ?? "#" : `/api/online-learning/lecture-resources/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    {r.type === "EXTERNAL_LINK" ? "Open" : "View / Download"}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-md border border-border p-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {status === "COMPLETED" ? "Lecture completed" : status === "IN_PROGRESS" ? "In progress" : "Not started"}
          </p>
          {primaryMedia && <ProgressBar percent={watchPercent} className="mt-2" />}
        </div>
        {status !== "COMPLETED" && !primaryMedia && (
          <Button size="sm" onClick={markComplete}>
            <CheckCircle2 className="h-4 w-4" /> Mark as complete
          </Button>
        )}
        {status === "COMPLETED" && <CheckCircle2 className="h-6 w-6 text-success" />}
      </div>
    </div>
  );
}
