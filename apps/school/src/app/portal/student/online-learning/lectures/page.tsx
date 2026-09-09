import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { listLecturesForStudent } from "@/lib/services/lectures";
import { ProgressBar } from "@/components/online-learning/progress-bar";

const STATUS_LABEL = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed" } as const;
const STATUS_VARIANT = { NOT_STARTED: "neutral", IN_PROGRESS: "warning", COMPLETED: "success" } as const;

export default async function StudentLecturesPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  const lectures = student ? await listLecturesForStudent(user.schoolId, student.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Lectures</h1>
        <p className="text-sm text-muted">Every lecture published for your class.</p>
      </div>

      {lectures.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No lectures have been published for your class." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lectures.map((lecture) => {
            const progress = lecture.progress[0];
            const status = progress?.status ?? "NOT_STARTED";
            return (
              <Card key={lecture.id}>
                <CardContent className="space-y-2 pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{lecture.subject.name}</p>
                    <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                  </div>
                  <p className="font-medium text-foreground">{lecture.title}</p>
                  <p className="text-sm text-muted">Teacher: {lecture.teacher.name}</p>
                  <ProgressBar percent={progress?.progressPercent ?? 0} />
                  <Link href={`/portal/student/online-learning/lectures/${lecture.id}`} className="text-sm font-medium text-accent hover:underline">
                    {status === "NOT_STARTED" ? "Start learning" : status === "COMPLETED" ? "Review lecture" : "Continue learning"}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
