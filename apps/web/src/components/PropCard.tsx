import { LockButton } from "./LockButton";
import { GenerateReferenceButton } from "./create/GenerateReferenceButton";

export interface PropCardProps {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description: string | null;
  continuityNotes: string | null;
  ownerCharacterName: string | null;
  isLocked: boolean;
  referenceImageUrl: string | null;
  imageProviderConfigured: boolean;
}

/**
 * PropCard: shows a Prop Bible entry, its reference image, and its lock
 * state. Unlike CharacterCard/LocationCard, there's no separate approve
 * step — Prop only has a single referenceAssetId, so regenerating just
 * replaces it directly once the prop isn't locked.
 */
export function PropCard(props: PropCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-cinerra-muted">{props.code}</p>
          <h3 className="text-base font-semibold">{props.name}</h3>
          {props.ownerCharacterName && <p className="text-xs text-cinerra-muted">{props.ownerCharacterName}&apos;s</p>}
        </div>
        <LockButton entityType="props" id={props.id} isLocked={props.isLocked} />
      </div>

      <div className="mt-3 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-cinerra-surface2">
        {props.referenceImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.referenceImageUrl} alt={`${props.name} reference`} className="h-full w-full object-cover" />
        ) : (
          <span className="p-4 text-center text-[11px] text-cinerra-muted">No reference image yet</span>
        )}
      </div>

      <div className="mt-2">
        {props.imageProviderConfigured ? (
          <GenerateReferenceButton entityType="props" entityId={props.id} projectId={props.projectId} hasReference={Boolean(props.referenceImageUrl)} />
        ) : (
          <p className="text-[11px] text-cinerra-muted">Image generation provider not configured.</p>
        )}
      </div>

      {props.description && <p className="mt-3 text-sm text-cinerra-text">{props.description}</p>}
      {props.continuityNotes && <p className="mt-1.5 text-xs text-cinerra-muted">{props.continuityNotes}</p>}
    </div>
  );
}
