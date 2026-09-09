import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getExamAnalytics } from "@/lib/services/cbt-results";
import { isCbtAiConfigured } from "@/lib/services/cbt-ai";
import { hasFeature } from "@/lib/billing/entitlements";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ReleaseResultsButton } from "./release-results-button";
import { ExamInsights } from "./exam-insights";
import type { CBTAttemptStatus } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<CBTAttemptStatus, "neutral" | "accent" | "success" | "warning"> = {
  IN_PROGRESS: "accent",
  SUBMITTED: "warning",
  AUTO_SUBMITTED: "warning",
  GRADED: "success",
  ABANDONED: "neutral",
};

export default async function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.CBT_VIEW_RESULTS);
  const perms = await getUserPermissions(user.id);
  const { id } = await params;

  const [analytics, canGenerateAi, canSeeAdvancedAnalytics] = await Promise.all([
    getExamAnalytics(user.schoolId, id),
    hasFeature(user.schoolId, "cbt_ai_generation"),
    hasFeature(user.schoolId, "cbt_advanced_analytics"),
  ]);
  if (!analytics) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Results</h1>
          <p className="text-sm text-muted">
            {analytics.attemptedCount} of {analytics.candidateCount} candidates attempted · {analytics.gradedCount} graded
            {analytics.pendingManualCount > 0 && ` · ${analytics.pendingManualCount} awaiting manual grading`}
          </p>
        </div>
        {perms.has(PERMISSIONS.CBT_PUBLISH) && !analytics.resultsReleasedAt && (
          <ReleaseResultsButton examId={id} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted">Average</p>
            <p className="text-2xl font-semibold text-foreground">{analytics.average ?? "—"}</p>
            <p className="text-xs text-muted">out of {analytics.totalMarks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted">Highest</p>
            <p className="text-2xl font-semibold text-foreground">{analytics.highest ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted">Lowest</p>
            <p className="text-2xl font-semibold text-foreground">{analytics.lowest ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted">Fully graded</p>
            <p className="text-2xl font-semibold text-foreground">{analytics.fullyGraded ? "Yes" : "No"}</p>
          </CardContent>
        </Card>
      </div>

      {canGenerateAi && <ExamInsights examId={id} aiConfigured={isCbtAiConfigured()} />}

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.students.length === 0 ? (
            <p className="text-sm text-muted">No attempts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.students.map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-muted">{s.admissionNumber}</TableCell>
                    <TableCell className="text-muted">#{s.attemptNumber}</TableCell>
                    <TableCell className="text-muted">{s.score ?? "—"}</TableCell>
                    <TableCell className="text-muted">{s.percentage != null ? `${s.percentage}%` : "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[s.status]}>{s.status.replace(/_/g, " ")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canSeeAdvancedAnalytics ? (
        <Card>
          <CardHeader>
            <CardTitle>Question analysis</CardTitle>
            <CardDescription>Facility = share of graded students who answered correctly. Essays show average marks instead.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.questionStats.length === 0 ? (
              <p className="text-sm text-muted">No graded answers yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Avg. marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.questionStats.map((q) => (
                    <TableRow key={q.questionId}>
                      <TableCell className="max-w-sm truncate">{q.prompt}</TableCell>
                      <TableCell className="text-muted">{q.type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-muted">{q.marks}</TableCell>
                      <TableCell className="text-muted">{q.facility != null ? `${q.facility}%` : "—"}</TableCell>
                      <TableCell className="text-muted">{q.averageMarks ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Question analysis</CardTitle>
            <CardDescription>Per-question facility and average-marks breakdown.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">Advanced CBT analytics isn&apos;t included in your current plan.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
