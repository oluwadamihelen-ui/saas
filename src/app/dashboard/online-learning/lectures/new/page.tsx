import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listTeachableAssignments } from "@/lib/services/lectures";
import { listTerms } from "@/lib/services/academics";
import { LectureForm } from "../lecture-form";
import { createLectureAction } from "../actions";

export default async function NewLecturePage() {
  const user = await requirePermission(PERMISSIONS.LECTURES_MANAGE);
  const [assignments, terms] = await Promise.all([listTeachableAssignments(user.schoolId, user.id), listTerms(user.schoolId)]);

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Lecture</h1>
        <p className="text-sm text-muted">Share a self-paced lecture with one of your assigned classes.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lecture details</CardTitle>
        </CardHeader>
        <CardContent>
          <LectureForm action={createLectureAction} assignments={assignments} terms={terms} submitLabel="Create lecture" />
        </CardContent>
      </Card>
    </div>
  );
}
