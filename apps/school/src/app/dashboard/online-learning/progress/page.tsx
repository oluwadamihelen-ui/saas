import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listLecturesForTeacher, getLectureProgressForTeacher } from "@/lib/services/lectures";

export default async function StudentProgressPage() {
  const user = await requirePermission(PERMISSIONS.LECTURES_VIEW);
  const lectures = await listLecturesForTeacher(user.schoolId, user.id, { status: "PUBLISHED" });
  const summaries = await Promise.all(
    lectures.map(async (lecture) => {
      const { summary } = await getLectureProgressForTeacher(user.schoolId, user.id, lecture.id);
      return { lecture, summary };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Student Progress</h1>
        <p className="text-sm text-muted">Completion progress across your published lectures.</p>
      </div>

      {summaries.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="No published lectures yet" description="Publish a lecture to start tracking student progress." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {summaries.map(({ lecture, summary }) => (
            <Card key={lecture.id}>
              <CardContent className="space-y-2 pt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {lecture.subject.name} · {lecture.classArm.classGroup.name} {lecture.classArm.name}
                </p>
                <p className="font-medium text-foreground">{lecture.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="neutral">{summary.notStarted} not started</Badge>
                  <Badge variant="warning">{summary.inProgress} in progress</Badge>
                  <Badge variant="success">{summary.completed} completed</Badge>
                </div>
                <p className="text-sm text-muted">Completion rate: <span className="font-medium text-foreground">{summary.completionRate}%</span></p>
                <Link href={`/dashboard/online-learning/lectures/${lecture.id}/progress`} className="text-sm font-medium text-accent hover:underline">
                  View details
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
