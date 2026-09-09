import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getExam } from "@/lib/services/cbt-exams";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ExamLifecycleActions } from "../exam-lifecycle-actions";
import type { CBTExamStatus } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<CBTExamStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SCHEDULED: "accent",
  PUBLISHED: "accent",
  LIVE: "success",
  ENDED: "warning",
  GRADING: "warning",
  COMPLETED: "success",
  ARCHIVED: "neutral",
};

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.CBT_VIEW);
  const perms = await getUserPermissions(user.id);
  const { id } = await params;

  const exam = await getExam(user.schoolId, id);
  if (!exam) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{exam.title}</h1>
            <Badge variant={STATUS_VARIANT[exam.status]}>{exam.status}</Badge>
          </div>
          <p className="text-sm text-muted">
            {exam.examType.label} · {exam.subject.name} · {exam.term.name}
            {exam.isPractice && " · Practice exam"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {perms.has(PERMISSIONS.CBT_VIEW_RESULTS) && (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/dashboard/cbt/exams/${exam.id}/results`}>Results</Link>
            </Button>
          )}
          <ExamLifecycleActions
            examId={exam.id}
            status={exam.status}
            canPublish={perms.has(PERMISSIONS.CBT_PUBLISH)}
            canEdit={perms.has(PERMISSIONS.CBT_EDIT)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted">Opens:</span> {formatDate(exam.startAt)}</p>
            <p><span className="text-muted">Closes:</span> {formatDate(exam.endAt)}</p>
            <p><span className="text-muted">Duration:</span> {exam.durationMinutes} minutes</p>
            <p><span className="text-muted">Max attempts:</span> {exam.maxAttempts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted">Mode:</span> {exam.questionSelectionMode === "MANUAL" ? "Fixed selection" : "Random per blueprint"}</p>
            {exam.questionSelectionMode === "MANUAL" ? (
              <>
                <p><span className="text-muted">Count:</span> {exam._count.examQuestions}</p>
                <p><span className="text-muted">Total marks:</span> {exam.totalMarks}</p>
              </>
            ) : (
              <p><span className="text-muted">Per attempt:</span> {exam.blueprint?.totalQuestions ?? 0} questions ({exam.blueprint?.rules.length ?? 0} rules)</p>
            )}
            <p><span className="text-muted">Negative marking:</span> {exam.negativeMarkingEnabled ? `-${exam.negativeMarkPerWrong} per wrong` : "Off"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Candidates & results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted">Assigned:</span> {exam._count.candidates} students</p>
            <p><span className="text-muted">Attempts so far:</span> {exam._count.attempts}</p>
            <p><span className="text-muted">Results visible:</span> {exam.resultVisibility.replace(/_/g, " ")}</p>
            {exam.assessmentComponent && <p><span className="text-muted">Posts to:</span> {exam.assessmentComponent.name}</p>}
          </CardContent>
        </Card>
      </div>

      {exam.instructions && (
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-foreground">{exam.instructions}</CardContent>
        </Card>
      )}

      {exam.questionSelectionMode === "MANUAL" ? (
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Marks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exam.examQuestions.map((eq, i) => (
                  <TableRow key={eq.id}>
                    <TableCell className="text-muted">{i + 1}</TableCell>
                    <TableCell className="max-w-md truncate">{eq.question.prompt}</TableCell>
                    <TableCell className="text-muted">{eq.question.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-muted">{eq.marksOverride ?? eq.question.marks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Blueprint rules</CardTitle>
            <CardDescription>Questions are randomly selected per rule when each student&apos;s attempt starts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exam.blueprint?.rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.topic ?? "Any topic"}</TableCell>
                    <TableCell className="text-muted">{r.difficulty ?? "Any"}</TableCell>
                    <TableCell className="text-muted">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          {exam.candidates.length === 0 ? (
            <p className="text-sm text-muted">No candidates assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Extra time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exam.candidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.student.firstName} {c.student.lastName}</TableCell>
                    <TableCell className="text-muted">{c.student.admissionNumber}</TableCell>
                    <TableCell className="text-muted">{c.attendanceStatus}</TableCell>
                    <TableCell className="text-muted">{c.extraTimeMinutes > 0 ? `+${c.extraTimeMinutes} min` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
