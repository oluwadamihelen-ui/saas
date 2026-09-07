import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getAssignment } from "@/lib/services/assignments";
import { formatDate } from "@/lib/utils";
import { SubmissionRow } from "./submission-row";

const STATUS_VARIANT = { PENDING: "neutral", SUBMITTED: "warning", GRADED: "success" } as const;

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.ASSIGNMENTS_MANAGE);

  const assignment = await getAssignment(user.schoolId, id);
  if (!assignment) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{assignment.title}</h1>
        <p className="text-sm text-muted">
          {assignment.classArm.classGroup.name} {assignment.classArm.name} · {assignment.subject.name} · Due {formatDate(assignment.dueDate)}
        </p>
      </div>

      {assignment.description && (
        <Card>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{assignment.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gradebook</CardTitle>
          <CardDescription>
            {canManage
              ? "Record what each student submitted and grade it."
              : "No student portal yet — a teacher records submissions here on the class's behalf."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {assignment.submissions.map((s) =>
            canManage ? (
              <SubmissionRow key={s.id} assignmentId={assignment.id} submission={s} />
            ) : (
              <div key={s.id} className="flex items-center justify-between border-b border-border p-3 text-sm last:border-b-0">
                <span className="font-medium text-foreground">{s.student.firstName} {s.student.lastName}</span>
                <div className="flex items-center gap-3 text-muted">
                  {s.score !== null && <span>{s.score}</span>}
                  <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
