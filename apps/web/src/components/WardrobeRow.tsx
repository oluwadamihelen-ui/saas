import { LockButton } from "./LockButton";
import { GenerateReferenceButton } from "./create/GenerateReferenceButton";

export interface WardrobeRowProps {
  id: string;
  projectId: string;
  code: string;
  name: string;
  clothing: string | null;
  isLocked: boolean;
  referenceImageUrl: string | null;
  imageProviderConfigured: boolean;
}

/** Compact wardrobe entry nested inside a CharacterCard — a wardrobe belongs to exactly one character, so it isn't a top-level card. */
export function WardrobeRow(props: WardrobeRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-cinerra-border p-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-cinerra-surface2">
        {props.referenceImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.referenceImageUrl} alt={`${props.name} reference`} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-cinerra-text">{props.name}</p>
        {props.clothing && <p className="truncate text-[11px] text-cinerra-muted">{props.clothing}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {props.imageProviderConfigured && (
          <GenerateReferenceButton entityType="wardrobes" entityId={props.id} projectId={props.projectId} hasReference={Boolean(props.referenceImageUrl)} />
        )}
        <LockButton entityType="wardrobes" id={props.id} isLocked={props.isLocked} />
      </div>
    </div>
  );
}
