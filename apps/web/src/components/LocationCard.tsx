import { LockButton } from "./LockButton";
import { GenerateReferenceButton } from "./create/GenerateReferenceButton";
import { ApproveReferenceButton } from "./create/ApproveReferenceButton";

export interface LocationCardProps {
  id: string;
  projectId: string;
  code: string;
  name: string;
  architecture: string | null;
  lighting: string | null;
  colorPalette: string | null;
  isLocked: boolean;
  primaryReference: { id: string; imageUrl: string; approvedAt: Date | null } | null;
  imageProviderConfigured: boolean;
}

/** LocationCard (spec §76): shows a Location Bible entry, its reference image, and its lock state. */
export function LocationCard(props: LocationCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-cinerra-muted">{props.code}</p>
          <h3 className="text-base font-semibold">{props.name}</h3>
        </div>
        <LockButton entityType="locations" id={props.id} isLocked={props.isLocked} />
      </div>

      <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-cinerra-surface2">
        {props.primaryReference ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.primaryReference.imageUrl} alt={`${props.name} reference`} className="h-full w-full object-cover" />
        ) : (
          <span className="p-4 text-center text-[11px] text-cinerra-muted">No reference image yet</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {props.imageProviderConfigured ? (
          <GenerateReferenceButton entityType="locations" entityId={props.id} projectId={props.projectId} hasReference={Boolean(props.primaryReference)} />
        ) : (
          <p className="text-[11px] text-cinerra-muted">Image generation provider not configured.</p>
        )}
        {props.primaryReference && !props.primaryReference.approvedAt && (
          <ApproveReferenceButton entityType="location-references" referenceId={props.primaryReference.id} />
        )}
        {props.primaryReference?.approvedAt && <span className="text-[11px] text-emerald-400">Approved</span>}
      </div>

      <dl className="mt-3 flex flex-col gap-1.5 text-xs text-cinerra-muted">
        {props.architecture && <Row label="Architecture" value={props.architecture} />}
        {props.lighting && <Row label="Lighting" value={props.lighting} />}
        {props.colorPalette && <Row label="Palette" value={props.colorPalette} />}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-medium text-cinerra-text">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
