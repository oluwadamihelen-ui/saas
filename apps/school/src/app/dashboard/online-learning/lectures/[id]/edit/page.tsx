import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getLectureForTeacher, listTeachableAssignments } from "@/lib/services/lectures";
import { listTerms } from "@/lib/services/academics";
import { LectureForm } from "../../lecture-form";
import { updateLectureAction } from "../../actions";

export default async function EditLecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.LECTURES_MANAGE);
  const [lecture, assignments, terms] = await Promise.all([
    getLectureForTeacher(user.schoolId, user.id, id),
    listTeachableAssignments(user.schoolId, user.id),
    listTerms(user.schoolId),
  ]);
  if (!lecture) notFound();

  const action = updateLectureAction.bind(null, lecture.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit lecture</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lecture details</CardTitle>
        </CardHeader>
        <CardContent>
          <LectureForm
            action={action}
            assignments={assignments}
            terms={terms}
            submitLabel="Save changes"
            defaults={{
              subjectClassKey: `${lecture.subjectId}|${lecture.classArmId}`,
              termId: lecture.termId,
              title: lecture.title,
              topic: lecture.topic ?? "",
              description: lecture.description ?? "",
              learningObjectives: lecture.learningObjectives ?? "",
              instructions: lecture.instructions ?? "",
              dueDate: lecture.dueDate ? lecture.dueDate.toISOString().slice(0, 10) : "",
              resources: lecture.resources.map((r) => ({ type: r.type, title: r.title, fileUrl: r.fileUrl })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
