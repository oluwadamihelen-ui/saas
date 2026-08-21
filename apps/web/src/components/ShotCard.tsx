import { GenerateShotButton } from "./create/GenerateShotButton";
import { GenerateDialogueButton } from "./create/GenerateDialogueButton";

export interface ShotCardProps {
  id: string;
  projectId: string;
  code: string;
  shotType: string;
  durationSeconds: number;
  action: string | null;
  dialogue: string | null;
  characterNames: string[];
  status: string;
  videoUrl: string | null;
  videoProviderConfigured: boolean;
  dialogueAudioUrl: string | null;
  voiceProviderConfigured: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Not generated yet",
  QUEUED: "Queued",
  GENERATING: "Generating…",
  NEEDS_REVISION: "Generation needs revision",
  READY: "Generated",
  FAILED: "Failed",
};

/** ShotCard (spec §30): one storyboard card per shot. */
export function ShotCard(props: ShotCardProps) {
  const canGenerate = props.status === "PENDING" || props.status === "FAILED";
  const canRegenerate = props.status === "READY";

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

      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-cinerra-surface2 text-[11px] text-cinerra-muted">
        {props.videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={props.videoUrl} controls className="h-full w-full object-cover" />
        ) : (
          "No preview yet"
        )}
      </div>

      <p className="text-sm font-medium">{props.shotType.replace(/_/g, " ")}</p>
      <p className="text-xs text-cinerra-muted">{props.durationSeconds} sec</p>
      {props.characterNames.length > 0 && <p className="text-xs text-cinerra-muted">{props.characterNames.join(" + ")}</p>}
      {props.action && <p className="text-xs text-cinerra-text">{props.action}</p>}
      {props.dialogue && <p className="text-xs italic text-cinerra-muted">&ldquo;{props.dialogue}&rdquo;</p>}

      {props.videoProviderConfigured ? (
        (canGenerate || canRegenerate) && <GenerateShotButton shotId={props.id} projectId={props.projectId} label={canRegenerate ? "Regenerate" : "Generate"} />
      ) : (
        <p className="text-[11px] text-cinerra-muted">Video generation provider not configured.</p>
      )}

      {props.dialogue && (
        <div className="border-t border-cinerra-border pt-2">
          {props.dialogueAudioUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio src={props.dialogueAudioUrl} controls className="h-8 w-full" />
          ) : props.voiceProviderConfigured ? (
            <GenerateDialogueButton shotId={props.id} projectId={props.projectId} />
          ) : (
            <p className="text-[11px] text-cinerra-muted">Voice generation provider not configured.</p>
          )}
        </div>
      )}
    </div>
  );
}
