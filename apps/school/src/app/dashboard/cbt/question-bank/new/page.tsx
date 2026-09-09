import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects, listClassGroups } from "@/lib/services/academics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionForm } from "../question-form";
import { createQuestionAction } from "../actions";

export default async function NewQuestionPage() {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);
  const [subjects, classGroups] = await Promise.all([listSubjects(user.schoolId), listClassGroups(user.schoolId)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add question</h1>
        <p className="text-sm text-muted">Manually authored questions are approved immediately and ready to use in an exam.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question details</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm action={createQuestionAction} submitLabel="Create question" subjects={subjects} classGroups={classGroups} />
        </CardContent>
      </Card>
    </div>
  );
}
