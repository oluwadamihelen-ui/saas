import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms, listSubjects } from "@/lib/services/academics";
import { getAccessibleAssignments } from "@/lib/services/teacher-scope";
import { AssignmentForm } from "./assignment-form";

export default async function NewAssignmentPage() {
  const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_MANAGE);
  const perms = await getUserPermissions(user.id);
  const [allClassArms, allSubjects] = await Promise.all([listClassArms(user.schoolId), listSubjects(user.schoolId)]);

  // A teacher only sees the classes/subjects they hold a TeacherAssignment
  // for — the actual class+subject pairing is still re-checked server-side
  // in createAssignmentAction, since these two lists don't by themselves
  // guarantee only valid pairs get picked.
  const access = await getAccessibleAssignments(user.schoolId, user.id, perms);
  const classArms = access === "ALL" ? allClassArms : allClassArms.filter((a) => access.some((p) => p.classArmId === a.id));
  const subjects = access === "ALL" ? allSubjects : allSubjects.filter((s) => access.some((p) => p.subjectId === s.id));

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">New assignment</h1>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {access !== "ALL" && access.length === 0 ? (
            <EmptyState
              title="No subjects assigned to you"
              description="You aren't assigned to teach any subject/class yet — ask your school administrator to assign you to one."
            />
          ) : (
            <AssignmentForm classArms={classArms} subjects={subjects} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
