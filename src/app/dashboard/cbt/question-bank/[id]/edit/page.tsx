import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getQuestion } from "@/lib/services/cbt-questions";
import { listSubjects, listClassGroups } from "@/lib/services/academics";
import { getAccessibleSubjectIds, canActOnSubject } from "@/lib/services/teacher-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionForm } from "../../question-form";
import { updateQuestionAction } from "../../actions";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);
  const perms = await getUserPermissions(user.id);
  const { id } = await params;

  const [question, allSubjects, classGroups] = await Promise.all([
    getQuestion(user.schoolId, id),
    listSubjects(user.schoolId),
    listClassGroups(user.schoolId),
  ]);
  if (!question) notFound();

  const subjectAccess = await getAccessibleSubjectIds(user.schoolId, user.id, perms);
  if (!canActOnSubject(subjectAccess, question.subjectId)) notFound();
  const subjects = subjectAccess === "ALL" ? allSubjects : allSubjects.filter((s) => subjectAccess.has(s.id));

  const action = updateQuestionAction.bind(null, id);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit question</h1>
        <p className="text-sm text-muted">
          {question._count.examLinks > 0
            ? `Used in ${question._count.examLinks} exam${question._count.examLinks === 1 ? "" : "s"} — editing changes it everywhere it's used.`
            : "Not yet used in any exam."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question details</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm
            action={action}
            submitLabel="Save changes"
            subjects={subjects}
            classGroups={classGroups}
            initial={{
              subjectId: question.subjectId,
              classGroupId: question.classGroupId,
              type: question.type,
              difficulty: question.difficulty,
              topic: question.topic,
              subtopic: question.subtopic,
              learningObjective: question.learningObjective,
              prompt: question.prompt,
              marks: question.marks,
              explanation: question.explanation,
              rubric: question.rubric,
              acceptedAnswers: (question.acceptedAnswers as string[] | null) ?? null,
              options: question.options.map((o) => ({ text: o.text, matchText: o.matchText, isCorrect: o.isCorrect })),
              tagNames: question.tags.map((t) => t.tag.name),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
