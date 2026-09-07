import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms, listSubjects } from "@/lib/services/academics";
import { AssignmentForm } from "./assignment-form";

export default async function NewAssignmentPage() {
  const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_MANAGE);
  const [classArms, subjects] = await Promise.all([listClassArms(user.schoolId), listSubjects(user.schoolId)]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">New assignment</h1>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <AssignmentForm classArms={classArms} subjects={subjects} />
        </CardContent>
      </Card>
    </div>
  );
}
