import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listTeachableAssignments } from "@/lib/services/lectures";
import { listTerms } from "@/lib/services/academics";
import { LiveClassForm } from "../live-class-form";
import { scheduleLiveClassAction } from "../actions";

export default async function NewLiveClassPage() {
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_MANAGE);
  const [assignments, terms] = await Promise.all([listTeachableAssignments(user.schoolId, user.id), listTerms(user.schoolId)]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Schedule Live Class</h1>
        <p className="text-sm text-muted">Students in the selected class will be notified once this class is scheduled.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Class details</CardTitle>
        </CardHeader>
        <CardContent>
          <LiveClassForm action={scheduleLiveClassAction} assignments={assignments} terms={terms} submitLabel="Schedule class" />
        </CardContent>
      </Card>
    </div>
  );
}
