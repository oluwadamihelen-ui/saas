import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { listLecturesForStudent } from "@/lib/services/lectures";
import { formatDate } from "@/lib/utils";

export default async function CompletedLessonsPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  const lectures = student ? await listLecturesForStudent(user.schoolId, student.id) : [];
  const completed = lectures.filter((l) => l.progress[0]?.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Completed Lessons</h1>
        <p className="text-sm text-muted">Lectures you have finished.</p>
      </div>

      {completed.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="No completed lessons yet" description="Lectures you finish will show up here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {completed.map((lecture) => (
            <Card key={lecture.id}>
              <CardContent className="space-y-1 pt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{lecture.subject.name}</p>
                <p className="font-medium text-foreground">{lecture.title}</p>
                <p className="text-sm text-muted">
                  Completed {lecture.progress[0]?.completedAt ? formatDate(lecture.progress[0].completedAt) : ""}
                </p>
                <Link href={`/portal/student/online-learning/lectures/${lecture.id}`} className="text-sm font-medium text-accent hover:underline">
                  Review
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
