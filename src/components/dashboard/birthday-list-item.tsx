import Link from "next/link";
import { Cake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PersonAvatar } from "./person-avatar";
import { MONTH_NAMES, birthdayLabel, type BirthdayPerson } from "@/lib/services/birthdays";

/// One row, shared by the dashboard widget and the birthday directory
/// page — the only difference between the two is how many of these are
/// rendered and what feeds the list, not how a single person is shown.
export function BirthdayListItem({ person }: { person: BirthdayPerson }) {
  const dateLabel = `${MONTH_NAMES[person.month - 1]} ${person.day}`;
  const content = (
    <>
      <PersonAvatar name={person.name} photoUrl={person.photoUrl} className="h-10 w-10 text-sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{person.name}</span>
          <Badge variant={person.type === "STUDENT" ? "accent" : "secondary"}>
            {person.type === "STUDENT" ? "Student" : "Staff"}
          </Badge>
        </div>
        {person.secondaryLabel && <p className="truncate text-xs text-muted">{person.secondaryLabel}</p>}
      </div>
      <div className="shrink-0 text-right">
        {person.isToday ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            <Cake className="h-3.5 w-3.5" /> Happy Birthday Today!
          </span>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">{dateLabel}</p>
            <p className="text-xs text-muted">{birthdayLabel(person.daysUntil)}</p>
          </>
        )}
      </div>
    </>
  );

  const rowClassName = `flex flex-wrap items-center gap-3 rounded-md py-3 ${person.isToday ? "bg-accent-soft/40 px-3" : ""}`;

  // Only students have an existing profile page to link to (see
  // src/app/dashboard/staff — no staff detail page exists yet); staff
  // rows stay non-interactive rather than linking anywhere.
  return (
    <li>
      {person.type === "STUDENT" ? (
        <Link href={`/dashboard/students/${person.id}`} className={`${rowClassName} transition-colors hover:bg-muted-surface`}>
          {content}
        </Link>
      ) : (
        <div className={rowClassName}>{content}</div>
      )}
    </li>
  );
}
