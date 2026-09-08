import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { listAssignmentsForStudent } from "@/lib/services/assignments";
import { formatDate } from "@/lib/utils";

export default async function StudentDashboardPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const assignments = await listAssignmentsForStudent(user.schoolId, student.id);
  const upcoming = assignments.filter((a) => a.status !== "GRADED").slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome, {student.firstName}
        </h1>
        <p className="text-sm text-muted">
          {student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "Unassigned"}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-foreground">Upcoming assignments</p>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing due right now" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="text-foreground">{s.assignment.title}</span>
                  <span className="text-muted">Due {formatDate(s.assignment.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/portal/student/assignments" className="text-sm text-accent hover:underline">
            View all assignments
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
