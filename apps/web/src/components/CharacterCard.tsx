import { LockButton } from "./LockButton";
import { GenerateReferenceButton } from "./create/GenerateReferenceButton";
import { ApproveReferenceButton } from "./create/ApproveReferenceButton";
import { WardrobeRow, type WardrobeRowProps } from "./WardrobeRow";

export interface CharacterCardProps {
  id: string;
  projectId: string;
  code: string;
  name: string;
  age: number | null;
  face: string | null;
  hair: string | null;
  eyes: string | null;
  personality: string | null;
  voiceProfile: string | null;
  isLocked: boolean;
  primaryReference: { id: string; imageUrl: string; approvedAt: Date | null } | null;
  imageProviderConfigured: boolean;
  wardrobes: Omit<WardrobeRowProps, "projectId" | "imageProviderConfigured">[];
}

/** CharacterCard (spec §76): shows a Character Bible entry, its reference image, and its lock state. */
export function CharacterCard(props: CharacterCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-cinerra-muted">{props.code}</p>
          <h3 className="text-base font-semibold">
            {props.name}
            {props.age ? <span className="ml-1 font-normal text-cinerra-muted">· {props.age}</span> : null}
          </h3>
        </div>
        <LockButton entityType="characters" id={props.id} isLocked={props.isLocked} />
      </div>

      <div className="mt-3 flex items-center justify-center overflow-hidden rounded-lg bg-cinerra-surface2" style={{ aspectRatio: "3/4" }}>
        {props.primaryReference ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.primaryReference.imageUrl} alt={`${props.name} reference`} className="h-full w-full object-cover" />
        ) : (
          <span className="p-4 text-center text-[11px] text-cinerra-muted">No reference image yet</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {props.imageProviderConfigured ? (
          <GenerateReferenceButton entityType="characters" entityId={props.id} projectId={props.projectId} hasReference={Boolean(props.primaryReference)} />
        ) : (
          <p className="text-[11px] text-cinerra-muted">Image generation provider not configured.</p>
        )}
        {props.primaryReference && !props.primaryReference.approvedAt && (
          <ApproveReferenceButton entityType="character-references" referenceId={props.primaryReference.id} />
        )}
        {props.primaryReference?.approvedAt && <span className="text-[11px] text-emerald-400">Approved</span>}
      </div>

      <dl className="mt-3 flex flex-col gap-1.5 text-xs text-cinerra-muted">
        {props.face && <Row label="Face" value={props.face} />}
        {props.hair && <Row label="Hair" value={props.hair} />}
        {props.eyes && <Row label="Eyes" value={props.eyes} />}
        {props.voiceProfile && <Row label="Voice" value={props.voiceProfile} />}
      </dl>
      {props.personality && <p className="mt-3 text-sm text-cinerra-text">{props.personality}</p>}

      {props.wardrobes.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-cinerra-border pt-3">
          {props.wardrobes.map((w) => (
            <WardrobeRow key={w.id} {...w} projectId={props.projectId} imageProviderConfigured={props.imageProviderConfigured} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-14 shrink-0 font-medium text-cinerra-text">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
