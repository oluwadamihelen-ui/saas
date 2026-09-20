import Link from "next/link";
import { Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BirthdayListItem } from "./birthday-list-item";
import type { BirthdayPerson } from "@/lib/services/birthdays";

export function UpcomingBirthdaysWidget({ people }: { people: BirthdayPerson[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="h-4 w-4 text-accent" /> Upcoming Birthdays
        </CardTitle>
        <CardDescription>The next {people.length === 1 ? "birthday" : "birthdays"} coming up for students and staff.</CardDescription>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <EmptyState title="No upcoming birthdays to display." description="Birthdays appear here once a date of birth is on file for a student or staff member." />
        ) : (
          <ul className="divide-y divide-border">
            {people.map((p) => (
              <BirthdayListItem key={`${p.type}-${p.id}`} person={p} />
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Link href="/dashboard/birthdays" className="text-sm text-accent hover:underline">
            View all birthdays &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
