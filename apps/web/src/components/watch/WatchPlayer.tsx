"use client";

import { useRef } from "react";

type Milestone = "STARTED" | "QUARTER" | "HALF" | "THREE_QUARTER" | "COMPLETED";

const PROGRESS_THRESHOLDS: { fraction: number; milestone: Milestone }[] = [
  { fraction: 0.25, milestone: "QUARTER" },
  { fraction: 0.5, milestone: "HALF" },
  { fraction: 0.75, milestone: "THREE_QUARTER" },
];

export function WatchPlayer({ projectId, episodeId, videoUrl, className }: { projectId: string; episodeId: string; videoUrl: string; className?: string }) {
  // Tracks which milestones have already fired this mount, so seeking back
  // and forth across a threshold doesn't send duplicate events — this is a
  // client-side courtesy, not a security boundary (ViewingEvent is
  // analytics, not financial, so a determined client re-posting isn't
  // worth defending against server-side).
  const fired = useRef<Set<Milestone>>(new Set());

  function send(type: Milestone) {
    if (fired.current.has(type)) return;
    fired.current.add(type);
    fetch("/api/viewing-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, episodeId, type }),
      keepalive: true, // survives a tab close / navigation shortly after the request starts
    }).catch(() => {
      // Best-effort — a dropped analytics event must never surface as a player error.
    });
  }

  return (
    <video
      src={videoUrl}
      controls
      className={className}
      onPlay={() => send("STARTED")}
      onTimeUpdate={(e) => {
        const video = e.currentTarget;
        if (!video.duration) return;
        const fraction = video.currentTime / video.duration;
        for (const { fraction: threshold, milestone } of PROGRESS_THRESHOLDS) {
          if (fraction >= threshold) send(milestone);
        }
      }}
      onEnded={() => send("COMPLETED")}
    />
  );
}
