import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_BADGE: Record<Status, "success" | "danger" | "warning" | "neutral"> = {
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  EXCUSED: "neutral",
};

export function RosterReadOnly({
  roster,
}: {
  roster: { student: { id: string; firstName: string; lastName: string }; record: { status: Status } | null }[];
}) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {roster.map(({ student, record }) => (
        <li key={student.id} className="flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={`${student.firstName} ${student.lastName}`} />
            <span className="text-sm font-medium text-foreground">{student.firstName} {student.lastName}</span>
          </div>
          {record ? <Badge variant={STATUS_BADGE[record.status]}>{record.status}</Badge> : <Badge variant="neutral">Not marked</Badge>}
        </li>
      ))}
    </ul>
  );
}
