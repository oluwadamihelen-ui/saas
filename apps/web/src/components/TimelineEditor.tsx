"use client";

import { useRef, useState } from "react";

export interface TimelineMix {
  timelineItemId: string;
  volume: number;
  muted: boolean;
}

export interface TimelineShot {
  id: string;
  code: string;
  action: string | null;
  durationSeconds: number;
  dialogue: TimelineMix | null;
  sfx: TimelineMix | null;
}

export function TimelineEditor({
  projectId,
  episodeId,
  initialShots,
  initialMusic,
}: {
  projectId: string;
  episodeId: string;
  initialShots: TimelineShot[];
  initialMusic: TimelineMix | null;
}) {
  const [shots, setShots] = useState(initialShots);
  const [orderStatus, setOrderStatus] = useState<"idle" | "saving" | "error">("idle");
  const dragIndex = useRef<number | null>(null);

  async function persistOrder(next: TimelineShot[]) {
    setOrderStatus("saving");
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${episodeId}/timeline/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shotIds: next.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error();
      setOrderStatus("idle");
    } catch {
      setOrderStatus("error");
    }
  }

  function handleDrop(dropIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === dropIndex) return;

    const next = [...shots];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved!);
    setShots(next);
    void persistOrder(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cinerra-muted">Shots</h2>
          <StatusBadge status={orderStatus} />
        </div>
        <div className="flex flex-col gap-2">
          {shots.map((shot, index) => (
            <ShotRow
              key={shot.id}
              shot={shot}
              index={index}
              onDragStart={() => (dragIndex.current = index)}
              onDrop={() => handleDrop(index)}
            />
          ))}
        </div>
      </section>

      {initialMusic && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-cinerra-muted">Score</h2>
          <div className="card flex items-center gap-4">
            <span className="text-sm text-cinerra-text">Episode background score</span>
            <MixControls mix={initialMusic} />
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "idle" | "saving" | "error" }) {
  if (status === "saving") return <span className="text-xs text-cinerra-muted">Saving order…</span>;
  if (status === "error") return <span className="text-xs text-red-300">Couldn't save order — try again.</span>;
  return null;
}

function ShotRow({
  shot,
  index,
  onDragStart,
  onDrop,
}: {
  shot: TimelineShot;
  index: number;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop();
      }}
      className={`card flex cursor-grab items-center gap-3 transition active:cursor-grabbing ${
        dragOver ? "border-cinerra-accent/60 bg-cinerra-surface2" : ""
      }`}
    >
      <span className="shrink-0 text-cinerra-muted" aria-hidden>
        <DragHandleIcon />
      </span>
      <span className="w-6 shrink-0 text-center text-xs text-cinerra-muted">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-cinerra-text">{shot.code}</p>
        {shot.action && <p className="line-clamp-1 text-xs text-cinerra-muted">{shot.action}</p>}
      </div>
      <span className="shrink-0 text-xs text-cinerra-muted">{shot.durationSeconds}s</span>
      <div className="flex shrink-0 items-center gap-3">
        {shot.dialogue && <MixControls mix={shot.dialogue} label="Dialogue" />}
        {shot.sfx && <MixControls mix={shot.sfx} label="SFX" />}
      </div>
    </div>
  );
}

function MixControls({ mix, label }: { mix: TimelineMix; label?: string }) {
  const [volume, setVolume] = useState(mix.volume);
  const [muted, setMuted] = useState(mix.muted);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function save(next: { volume?: number; muted?: boolean }) {
    setSaving(true);
    try {
      await fetch(`/api/timeline-items/${mix.timelineItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } finally {
      setSaving(false);
    }
  }

  function onVolumeChange(next: number) {
    setVolume(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save({ volume: next }), 300);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    void save({ muted: next });
  }

  return (
    <div className="flex items-center gap-1.5" title={label}>
      {label && <span className="text-[10px] text-cinerra-muted">{label}</span>}
      <button
        type="button"
        onClick={toggleMute}
        className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
          muted ? "bg-cinerra-surface2 text-cinerra-muted" : "text-cinerra-accent"
        }`}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <MutedIcon /> : <VolumeIcon />}
      </button>
      <input
        type="range"
        min={0}
        max={2}
        step={0.05}
        value={volume}
        disabled={muted}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        className="h-1 w-16 accent-cinerra-accent disabled:opacity-40"
        aria-label={`${label ?? "Track"} volume`}
      />
      <span className="w-8 text-[10px] text-cinerra-muted">{saving ? "…" : `${Math.round(volume * 100)}%`}</span>
    </div>
  );
}

function DragHandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
      <path d="M16 8a5 5 0 0 1 0 8" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </svg>
  );
}
