export interface ShotCardProps {
  code: string;
  shotType: string;
  durationSeconds: number;
  action: string | null;
  dialogue: string | null;
  characterNames: string[];
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Not generated yet",
  QUEUED: "Queued",
  GENERATING: "Generating…",
  NEEDS_REVISION: "Generation needs revision",
  READY: "Generated",
  FAILED: "Failed",
};

/** ShotCard (spec §30): one storyboard card per shot. Video generation is a later phase — status is always honest, never faked. */
export function ShotCard(props: ShotCardProps) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-cinerra-muted">{props.code}</span>
        <span
          className={`text-[11px] ${
            props.status === "READY" ? "text-emerald-400" : props.status === "FAILED" || props.status === "NEEDS_REVISION" ? "text-red-300" : "text-cinerra-muted"
          }`}
        >
          {STATUS_LABEL[props.status] ?? props.status}
        </span>
      </div>
      <div className="flex aspect-video items-center justify-center rounded-lg bg-cinerra-surface2 text-[11px] text-cinerra-muted">
        No preview yet
      </div>
      <p className="text-sm font-medium">{props.shotType.replace(/_/g, " ")}</p>
      <p className="text-xs text-cinerra-muted">{props.durationSeconds} sec</p>
      {props.characterNames.length > 0 && <p className="text-xs text-cinerra-muted">{props.characterNames.join(" + ")}</p>}
      {props.action && <p className="text-xs text-cinerra-text">{props.action}</p>}
      {props.dialogue && <p className="text-xs italic text-cinerra-muted">&ldquo;{props.dialogue}&rdquo;</p>}
    </div>
  );
}
