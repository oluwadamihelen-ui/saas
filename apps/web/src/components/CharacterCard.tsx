import { LockButton } from "./LockButton";

export interface CharacterCardProps {
  id: string;
  code: string;
  name: string;
  age: number | null;
  face: string | null;
  hair: string | null;
  eyes: string | null;
  personality: string | null;
  voiceProfile: string | null;
  isLocked: boolean;
}

/** CharacterCard (spec §76): shows a Character Bible entry with its lock state. */
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
      <dl className="mt-3 flex flex-col gap-1.5 text-xs text-cinerra-muted">
        {props.face && <Row label="Face" value={props.face} />}
        {props.hair && <Row label="Hair" value={props.hair} />}
        {props.eyes && <Row label="Eyes" value={props.eyes} />}
        {props.voiceProfile && <Row label="Voice" value={props.voiceProfile} />}
      </dl>
      {props.personality && <p className="mt-3 text-sm text-cinerra-text">{props.personality}</p>}
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
