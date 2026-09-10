import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatMonthDay } from "@/lib/utils";
import type { BirthdayEntry } from "@/lib/services/birthdays";

const PERSON_TYPE_VARIANT = { STUDENT: "accent", STAFF: "secondary" } as const;
const PERSON_TYPE_LABEL = { STUDENT: "Student", STAFF: "Staff" } as const;

/// Shared row rendering for both the dashboard widget and the full
/// directory page, so the two never drift in how a birthday is presented.
export function BirthdayList({ entries, emptyMessage }: { entries: BirthdayEntry[]; emptyMessage?: string }) {
  if (entries.length === 0) {
    return <EmptyState title={emptyMessage ?? "No upcoming birthdays to display."} className="border-0 py-6" />;
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => (
        <li key={`${entry.personType}:${entry.id}`} className={cn("flex items-center gap-3 px-3 py-2.5 sm:px-4", entry.isToday && "bg-warning-soft")}>
          {entry.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- may be a data: URL, next/image can't optimize it
            <img src={entry.photoUrl} alt={entry.name} className="h-9 w-9 shrink-0 rounded-full border border-border object-cover" />
          ) : (
            <Avatar name={entry.name} className="h-9 w-9 text-xs" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {entry.profileHref ? (
                <Link href={entry.profileHref} className="truncate text-sm font-medium text-foreground hover:text-accent">
                  {entry.name}
                </Link>
              ) : (
                <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
              )}
              <Badge variant={PERSON_TYPE_VARIANT[entry.personType]}>{PERSON_TYPE_LABEL[entry.personType]}</Badge>
            </div>
            <p className="truncate text-xs text-muted">
              {entry.subtitle ?? "—"} · {formatMonthDay(entry.month, entry.day)}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {entry.isToday ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-warning">
                <PartyPopper className="h-4 w-4" aria-hidden="true" />
                Happy Birthday Today!
              </span>
            ) : (
              <span className="text-sm font-medium text-muted">{entry.label}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
