import { notFound, redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { getExamForCandidate } from "@/lib/services/cbt-attempts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { StartExamButton } from "../start-exam-button";

export default async function ExamInstructionsPage({ params }: { params: Promise<{ examId: string }> }) {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();
  const { examId } = await params;

  const candidate = await getExamForCandidate(user.schoolId, student.id, examId);
  if (!candidate) notFound();
  const { exam, attempts } = candidate;

  const inProgress = attempts.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) redirect(`/portal/student/cbt/${exam.id}/attempt/${inProgress.id}`);

  const usedAttempts = attempts.filter((a) => a.status !== "ABANDONED").length;
  const maxAttempts = candidate.maxAttemptsOverride ?? exam.maxAttempts;
  const canStart = exam.status === "LIVE" && usedAttempts < maxAttempts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{exam.title}</h1>
        <p className="text-sm text-muted">{exam.subject.name} · {exam.examType.label}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Before you start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-muted">Opens</p>
              <p className="font-medium text-foreground">{formatDate(exam.startAt)}</p>
            </div>
            <div>
              <p className="text-muted">Closes</p>
              <p className="font-medium text-foreground">{formatDate(exam.endAt)}</p>
            </div>
            <div>
              <p className="text-muted">Duration</p>
              <p className="font-medium text-foreground">{exam.durationMinutes} minutes{candidate.extraTimeMinutes > 0 ? ` (+${candidate.extraTimeMinutes} extra)` : ""}</p>
            </div>
            <div>
              <p className="text-muted">Attempts</p>
              <p className="font-medium text-foreground">{usedAttempts} of {maxAttempts} used</p>
            </div>
          </div>

          {exam.instructions && (
            <div>
              <p className="mb-1 font-medium text-foreground">Instructions</p>
              <p className="whitespace-pre-wrap text-muted">{exam.instructions}</p>
            </div>
          )}

          <ul className="list-inside list-disc space-y-1 text-muted">
            <li>Once you start, the timer cannot be paused — make sure you have a stable connection.</li>
            <li>Your answers are saved automatically as you work through the exam.</li>
            {exam.autoSubmitOnExpiry && <li>The exam will submit automatically when time runs out.</li>}
            {exam.requireFullscreen && <li>This exam requires fullscreen mode.</li>}
            {exam.desktopOnly && <li>This exam must be taken on a desktop or laptop computer.</li>}
          </ul>

          {!canStart ? (
            <Badge variant="neutral">
              {exam.status !== "LIVE" ? "This exam is not currently open." : "You have used all your attempts."}
            </Badge>
          ) : (
            <StartExamButton examId={exam.id} label={usedAttempts > 0 ? "Start next attempt" : "Start exam"} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
