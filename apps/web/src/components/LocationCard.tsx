import { LockButton } from "./LockButton";

export interface LocationCardProps {
  id: string;
  code: string;
  name: string;
  architecture: string | null;
  lighting: string | null;
  colorPalette: string | null;
  isLocked: boolean;
}

/** LocationCard (spec §76): shows a Location Bible entry with its lock state. */
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
