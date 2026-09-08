import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { listAssignmentsForStudent } from "@/lib/services/assignments";
import { formatDate } from "@/lib/utils";

const SUBMISSION_BADGE = { PENDING: "neutral", SUBMITTED: "accent", GRADED: "success" } as const;

export default async function StudentAssignmentsPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const assignments = await listAssignmentsForStudent(user.schoolId, student.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Assignments</h1>
        <p className="text-sm text-muted">Your teacher records submissions and grades here once you hand work in.</p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState title="No assignments yet" />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {assignments.map((s) => (
            <li key={s.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{s.assignment.title}</p>
                <p className="text-xs text-muted">{s.assignment.subject.name} · Due {formatDate(s.assignment.dueDate)}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.score !== null && <span className="text-muted">{s.score}</span>}
                <Badge variant={SUBMISSION_BADGE[s.status]}>{s.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
