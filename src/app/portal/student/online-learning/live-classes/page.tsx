import Link from "next/link";
import { Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { listLiveClassesForStudent } from "@/lib/services/live-classes";
import { formatDate } from "@/lib/utils";

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export default async function StudentLiveClassesPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  const liveClasses = student ? await listLiveClassesForStudent(user.schoolId, student.id) : [];

  const now = new Date();
  const liveNow = liveClasses.filter((lc) => lc.status === "LIVE");
  const today = liveClasses.filter((lc) => lc.status === "SCHEDULED" && isSameDay(lc.scheduledStart, now));
  const upcoming = liveClasses.filter((lc) => lc.status === "SCHEDULED" && !isSameDay(lc.scheduledStart, now));
  const past = liveClasses.filter((lc) => lc.status === "COMPLETED" || lc.status === "CANCELLED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live Classes</h1>
        <p className="text-sm text-muted">Join live video classes for your class, taught directly inside Schoolum.</p>
      </div>

      {liveClasses.length === 0 ? (
        <EmptyState icon={<Video className="h-6 w-6" />} title="No live classes are scheduled." />
      ) : (
        <>
          {liveNow.length > 0 && (
            <Section title="Live Now">
              {liveNow.map((lc) => (
                <LiveClassCard key={lc.id} lc={lc} action={<Button asChild size="sm"><Link href={`/classroom/${lc.id}`}>Join Class</Link></Button>} />
              ))}
            </Section>
          )}

          {today.length > 0 && (
            <Section title="Today's Classes">
              {today.map((lc) => (
                <LiveClassCard key={lc.id} lc={lc} action={<Button asChild size="sm" variant="secondary"><Link href={`/classroom/${lc.id}`}>Open waiting room</Link></Button>} />
              ))}
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section title="Upcoming">
              {upcoming.map((lc) => (
                <LiveClassCard key={lc.id} lc={lc} />
              ))}
            </Section>
          )}

          {past.length > 0 && (
            <Section title="Past Classes">
              {past.map((lc) => (
                <LiveClassCard key={lc.id} lc={lc} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const STATUS_VARIANT = { SCHEDULED: "accent", LIVE: "success", COMPLETED: "neutral", CANCELLED: "warning" } as const;

function LiveClassCard({
  lc,
  action,
}: {
  lc: { id: string; title: string; status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED"; scheduledStart: Date; durationMinutes: number; subject: { name: string }; teacher: { name: string } };
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{lc.subject.name}</p>
          <Badge variant={STATUS_VARIANT[lc.status]}>{lc.status}</Badge>
        </div>
        <p className="font-medium text-foreground">{lc.title}</p>
        <p className="text-sm text-muted">
          Teacher: {lc.teacher.name} · {formatDate(lc.scheduledStart)} · {lc.durationMinutes} min
        </p>
        {action}
      </CardContent>
    </Card>
  );
}
