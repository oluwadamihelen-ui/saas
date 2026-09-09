import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getLiveClassForTeacher } from "@/lib/services/live-classes";
import { listTeachableAssignments } from "@/lib/services/lectures";
import { listTerms } from "@/lib/services/academics";
import { LiveClassForm } from "../../live-class-form";
import { updateLiveClassAction } from "../../actions";

export default async function EditLiveClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_MANAGE);
  const [liveClass, assignments, terms] = await Promise.all([
    getLiveClassForTeacher(user.schoolId, user.id, id),
    listTeachableAssignments(user.schoolId, user.id),
    listTerms(user.schoolId),
  ]);
  if (!liveClass) notFound();
  if (liveClass.status !== "SCHEDULED") notFound();

  const action = updateLiveClassAction.bind(null, liveClass.id);
  const scheduled = liveClass.scheduledStart;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit Live Class</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Class details</CardTitle>
        </CardHeader>
        <CardContent>
          <LiveClassForm
            action={action}
            assignments={assignments}
            terms={terms}
            submitLabel="Save changes"
            defaults={{
              subjectClassKey: `${liveClass.subjectId}|${liveClass.classArmId}`,
              termId: liveClass.termId,
              title: liveClass.title,
              topic: liveClass.topic ?? "",
              description: liveClass.description ?? "",
              scheduledDate: scheduled.toISOString().slice(0, 10),
              scheduledTime: scheduled.toISOString().slice(11, 16),
              durationMinutes: liveClass.durationMinutes,
              maxParticipants: liveClass.maxParticipants ?? "",
              joinWindowMinutesBefore: liveClass.joinWindowMinutesBefore,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
