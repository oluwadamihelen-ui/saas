import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { getExamForCandidate } from "@/lib/services/cbt-attempts";
import { getExamResultForStudent } from "@/lib/services/cbt-results";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function StudentExamResultPage({ params }: { params: Promise<{ examId: string }> }) {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();
  const { examId } = await params;

  const candidate = await getExamForCandidate(user.schoolId, student.id, examId);
  if (!candidate) notFound();

  const result = await getExamResultForStudent(user.schoolId, student.id, examId);
  if (!result) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{candidate.exam.title}</h1>
        <p className="text-sm text-muted">{candidate.exam.subject.name} · {candidate.exam.examType.label}</p>
      </div>

      {result.status !== "visible" ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            {result.status === "no-attempt" && "You have no completed attempt for this exam."}
            {result.status === "pending-grading" && "Your result isn't ready yet — grading is still in progress."}
            {result.status === "pending-release" && "Grading is complete, but your teacher hasn't released results yet."}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
              <div>
                <p className="text-xs text-muted">Your score</p>
                <p className="text-3xl font-semibold text-foreground">
                  {result.score} <span className="text-lg font-normal text-muted">/ {result.totalMarks}</span>
                </p>
                <p className="text-sm text-muted">{result.percentage}%</p>
              </div>
              {result.rank && (
                <div className="text-right">
                  <p className="text-xs text-muted">Class rank</p>
                  <p className="text-2xl font-semibold text-foreground">{result.rank} <span className="text-sm font-normal text-muted">of {result.totalRanked}</span></p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Question breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.questions?.map((q, i) => (
                <div key={q.id} className="space-y-2 rounded-md border border-border p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="whitespace-pre-wrap text-foreground">{i + 1}. {q.prompt}</p>
                    {q.isCorrect !== null ? (
                      <Badge variant={q.isCorrect ? "success" : "danger"}>{q.marksAwarded} / {q.marks}</Badge>
                    ) : (
                      <Badge variant="neutral">{q.marksAwarded} / {q.marks}</Badge>
                    )}
                  </div>
                  {q.correctAnswer !== undefined && (
                    <p className="text-xs text-muted">Correct answer: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : String(q.correctAnswer)}</p>
                  )}
                  {q.explanation && <p className="text-xs text-muted">{q.explanation}</p>}
                  {q.feedback && <p className="text-xs italic text-muted">Feedback: {q.feedback}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
