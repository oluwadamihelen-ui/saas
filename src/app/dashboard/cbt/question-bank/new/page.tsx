import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects, listClassGroups } from "@/lib/services/academics";
import { getAccessibleSubjectIds } from "@/lib/services/teacher-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionForm } from "../question-form";
import { createQuestionAction } from "../actions";

export default async function NewQuestionPage() {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);
  const perms = await getUserPermissions(user.id);
  const [allSubjects, classGroups] = await Promise.all([listSubjects(user.schoolId), listClassGroups(user.schoolId)]);
  const subjectAccess = await getAccessibleSubjectIds(user.schoolId, user.id, perms);
  const subjects = subjectAccess === "ALL" ? allSubjects : allSubjects.filter((s) => subjectAccess.has(s.id));

  return (
    <div className="space-y-4 sm:space-y-6">
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
