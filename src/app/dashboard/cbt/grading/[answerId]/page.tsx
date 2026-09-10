import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getAnswerForGrading } from "@/lib/services/cbt-grading";
import { isCbtAiConfigured } from "@/lib/services/cbt-ai";
import { hasFeature } from "@/lib/billing/entitlements";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GradeForm } from "./grade-form";

export default async function GradeAnswerPage({ params }: { params: Promise<{ answerId: string }> }) {
  const user = await requirePermission(PERMISSIONS.CBT_GRADE);
  const { answerId } = await params;

  const [answer, canGenerateAi] = await Promise.all([
    getAnswerForGrading(user.schoolId, answerId),
    hasFeature(user.schoolId, "cbt_ai_generation"),
  ]);
  if (!answer) notFound();

  const response = typeof answer.response === "string" ? answer.response : JSON.stringify(answer.response);

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Grade answer</h1>
        <p className="text-sm text-muted">
          {answer.attempt.student.firstName} {answer.attempt.student.lastName} ({answer.attempt.student.admissionNumber}) · {answer.attempt.exam.title}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
          <CardDescription>Worth {answer.question.marks} mark{answer.question.marks === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm text-foreground">{answer.question.prompt}</p>
          {answer.question.rubric && (
            <div className="rounded-md bg-muted-surface p-3 text-sm">
              <p className="mb-1 font-medium text-foreground">Grading rubric</p>
              <p className="whitespace-pre-wrap text-muted">{answer.question.rubric}</p>
            </div>
          )}
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="mb-1 font-medium text-foreground">Student&apos;s answer</p>
            <p className="whitespace-pre-wrap text-foreground">{response || <span className="text-muted">No answer submitted</span>}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your grade</CardTitle>
        </CardHeader>
        <CardContent>
          <GradeForm
            answerId={answer.id}
            maxMarks={answer.question.marks}
            initialMarks={answer.manualGrade?.marksAwarded ?? undefined}
            initialFeedback={answer.manualGrade?.feedback ?? ""}
            aiConfigured={isCbtAiConfigured() && canGenerateAi}
          />
        </CardContent>
      </Card>
    </div>
  );
}
