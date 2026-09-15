import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { getStudentLearningSummary } from "@/lib/services/lectures";
import { listLiveClassesForStudent } from "@/lib/services/live-classes";
import { formatDate } from "@/lib/utils";
import { ProgressBar } from "@/components/online-learning/progress-bar";

export default async function StudentOnlineLearningPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) {
    return <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No student profile found" description="Contact your school administrator." />;
  }

  const [summary, liveClasses] = await Promise.all([
    getStudentLearningSummary(user.schoolId, student.id),
    listLiveClassesForStudent(user.schoolId, student.id),
  ]);

  const continueLearning = summary.lectures.filter((l) => l.progress[0]?.status === "IN_PROGRESS");
  const newLectures = summary.lectures.filter((l) => !l.progress[0]);
  const upcomingLive = liveClasses.filter((lc) => lc.status === "SCHEDULED" || lc.status === "LIVE").slice(0, 3);
  const subjects = [...new Map(summary.lectures.map((l) => [l.subject.id, l.subject.name])).values()];
  const overallRate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Learning</h1>
        <p className="text-sm text-muted">Your lectures, live classes and learning progress.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Lectures" value={summary.total} />
        <Stat label="Not started" value={summary.notStarted} />
        <Stat label="In progress" value={summary.inProgress} />
        <Stat label="Completed" value={summary.completed} />
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm font-medium text-foreground">Overall learning progress</p>
          <ProgressBar percent={overallRate} />
          <p className="text-xs text-muted">{overallRate}% of published lectures completed</p>
        </CardContent>
      </Card>

      {upcomingLive.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Live Classes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingLive.map((lc) => (
              <Card key={lc.id}>
                <CardContent className="space-y-2 pt-6">
                  <div className="flex items-center justify-between">
                    <Badge variant={lc.status === "LIVE" ? "success" : "accent"}>{lc.status === "LIVE" ? "Live now" : "Upcoming"}</Badge>
                    <span className="text-xs text-muted">{formatDate(lc.scheduledStart)}</span>
                  </div>
                  <p className="font-medium text-foreground">{lc.subject.name}</p>
                  <p className="text-sm text-muted">{lc.title} · {lc.teacher.name}</p>
                  {lc.status === "LIVE" ? (
                    <Button asChild size="sm">
                      <Link href={`/classroom/${lc.id}`}>Join Class</Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/portal/student/online-learning/live-classes">View details</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {continueLearning.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Continue Learning</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {continueLearning.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">New Lectures</h2>
        {newLectures.length === 0 ? (
          <p className="text-sm text-muted">No new lectures right now — check back soon.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {newLectures.slice(0, 6).map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} />
            ))}
          </div>
        )}
      </section>

      {subjects.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Subjects</h2>
          <div className="flex flex-wrap gap-2">
            {subjects.map((name) => (
              <Badge key={name} variant="neutral">{name}</Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function LectureCard({
  lecture,
}: {
  lecture: {
    id: string;
    title: string;
    subject: { name: string };
    teacher: { name: string };
    progress: { status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; progressPercent: number }[];
  };
}) {
  const progress = lecture.progress[0];
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{lecture.subject.name}</p>
        <p className="font-medium text-foreground">{lecture.title}</p>
        <p className="text-sm text-muted">Teacher: {lecture.teacher.name}</p>
        {progress && (
          <>
            <ProgressBar percent={progress.progressPercent} />
            <p className="text-xs text-muted">{progress.progressPercent}% · {progress.status === "COMPLETED" ? "Completed" : "In progress"}</p>
          </>
        )}
        <Button asChild size="sm">
          <Link href={`/portal/student/online-learning/lectures/${lecture.id}`}>{progress ? "Continue Learning" : "Start Learning"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
