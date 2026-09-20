import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PerformanceTrendChart } from "@/components/dashboard/performance-trend-chart";
import { RiskBadge, TrendBadge } from "@/components/dashboard/performance-badges";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentPerformanceAnalysis } from "@/lib/services/performance/analysis";
import { PerformanceAccessDeniedError } from "@/lib/services/performance/authorization";
import { listOrderedPeriods } from "@/lib/services/performance/periods";
import { isPerformanceAiConfigured } from "@/lib/services/performance/ai-summary";
import { AiSummaryCard } from "./ai-summary-card";

function pct(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

function changeLabel(v: number | null): string {
  if (v === null) return "—";
  return v > 0 ? `+${v} pts` : `${v} pts`;
}

export default async function StudentPerformanceAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ termId?: string }>;
}) {
  const { id: studentId } = await params;
  const { termId } = await searchParams;
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const perms = await getUserPermissions(user.id);

  let analysis;
  try {
    analysis = await getStudentPerformanceAnalysis(user.schoolId, user.id, perms, studentId, termId);
  } catch (error) {
    if (error instanceof PerformanceAccessDeniedError) {
      return (
        <div className="max-w-3xl">
          <EmptyState
            title="Not authorized"
            description="You can only view performance analysis for students in classes you're assigned to teach."
          />
        </div>
      );
    }
    if (error instanceof Error && error.message === "Student not found.") notFound();
    throw error;
  }

  const periods = await listOrderedPeriods(user.schoolId);
  const chartPoints = analysis.history.map((m) => ({
    label: `${m.period.academicSessionName} ${m.period.termName}`,
    average: m.overallAverage,
  }));

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <Link href={`/dashboard/students/${studentId}`} className="hover:text-accent hover:underline">
              {analysis.studentName}
            </Link>{" "}
            · {analysis.admissionNumber} · {analysis.className ?? "Unassigned"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance Analysis</h1>
          <p className="mt-1 text-sm text-muted">{analysis.metrics.period.academicSessionName} — {analysis.metrics.period.termName}</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="termId" className="text-xs">Academic period</Label>
            <Select id="termId" name="termId" defaultValue={analysis.metrics.period.termId} className="text-sm">
              {periods
                .slice()
                .reverse()
                .map((p) => (
                  <option key={p.termId} value={p.termId}>
                    {p.academicSessionName} — {p.termName}
                  </option>
                ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary" size="sm">View</Button>
        </form>
      </div>

      <Card className="border-accent/30 bg-accent-soft">
        <CardContent className="py-3 text-sm text-accent">
          Performance based on currently recorded scores — this reflects everything entered so far this term, not
          necessarily a finalized, approved report card.
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Current average" value={pct(analysis.metrics.overallAverage)} />
        <SummaryStat label="Previous average" value={pct(analysis.trend.previous?.overallAverage ?? null)} />
        <SummaryStat label="Change" value={changeLabel(analysis.trend.changePoints)} />
        <SummaryStat label="Attendance" value={pct(analysis.attendance.attendanceRate)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TrendBadge status={analysis.trend.status} />
        <RiskBadge level={analysis.risk.riskLevel} />
        {analysis.success.significantImprovement && <Badge variant="success">Significant improvement</Badge>}
        {analysis.success.consistentHighPerformance && <Badge variant="success">Consistent high performance</Badge>}
        {analysis.success.improvedAttendance && <Badge variant="success">Improved attendance</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance trend</CardTitle>
          <CardDescription>Overall average across the periods on record for this student.</CardDescription>
        </CardHeader>
        <CardContent>
          {chartPoints.length < 2 ? (
            <EmptyState title="Not enough academic data to chart a trend" description="At least two academic periods with recorded scores are needed." />
          ) : (
            <PerformanceTrendChart points={chartPoints} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk explanation</CardTitle>
          <CardDescription>Every factor below is calculated from this student&apos;s own recorded data — never a guess.</CardDescription>
        </CardHeader>
        <CardContent>
          {analysis.risk.reasons.length === 0 ? (
            <p className="text-sm text-muted">No risk factors identified for this period.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {analysis.risk.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isPerformanceAiConfigured() && <AiSummaryCard studentId={analysis.studentId} termId={analysis.metrics.period.termId} />}

      <Card>
        <CardHeader>
          <CardTitle>Subject analysis</CardTitle>
          {analysis.subjectAnalysis.availability === "INSUFFICIENT_DATA" && (
            <CardDescription>No subject scores recorded for this period yet.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis.subjectAnalysis.availability === "INSUFFICIENT_DATA" ? (
            <EmptyState title="No results are available for this academic period." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {analysis.subjectAnalysis.strongestSubject && (
                  <SummaryStat label="Strongest subject" value={analysis.subjectAnalysis.strongestSubject.subjectName} />
                )}
                {analysis.subjectAnalysis.weakestSubject && (
                  <SummaryStat label="Weakest subject" value={analysis.subjectAnalysis.weakestSubject.subjectName} />
                )}
                {analysis.subjectAnalysis.mostImprovedSubject && (
                  <SummaryStat label="Most improved" value={analysis.subjectAnalysis.mostImprovedSubject.subjectName} />
                )}
                {analysis.subjectAnalysis.mostDeclinedSubject && (
                  <SummaryStat label="Most declined" value={analysis.subjectAnalysis.mostDeclinedSubject.subjectName} />
                )}
              </div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {analysis.subjectAnalysis.subjects.map((s) => (
                  <li key={s.subjectId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span className="font-medium text-foreground">{s.subjectName}</span>
                    <div className="flex items-center gap-3 text-muted">
                      <span>{s.current}%{s.previous !== null ? ` (was ${s.previous}%)` : ""}</span>
                      <span>{changeLabel(s.changePoints)}</span>
                      <SubjectStatusBadge status={s.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.attendance.availability === "INSUFFICIENT_DATA" ? (
              <p className="text-sm text-muted">Attendance data unavailable for this period.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Rate" value={pct(analysis.attendance.attendanceRate)} />
                <Field label="Days present" value={String(analysis.attendance.daysPresent)} />
                <Field label="Days absent" value={String(analysis.attendance.daysAbsent)} />
                <Field label="Days late" value={String(analysis.attendance.daysLate)} />
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Practice CBT &amp; assignments</CardTitle>
            <CardDescription>Supplementary signals — separate from the academic average above.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted">Practice CBT average</p>
              <p className="text-foreground">
                {analysis.cbtPractice.availability === "AVAILABLE"
                  ? `${pct(analysis.cbtPractice.averagePercentage)} across ${analysis.cbtPractice.attemptCount} attempt(s)`
                  : "No practice attempts recorded"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Assignment completion</p>
              <p className="text-foreground">
                {analysis.assignments.availability === "AVAILABLE"
                  ? `${pct(analysis.assignments.completionRate)} (${analysis.assignments.gradedOrSubmitted}/${analysis.assignments.totalAssignments})`
                  : "No assignments recorded"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="truncate text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}

function SubjectStatusBadge({ status }: { status: "IMPROVING" | "STABLE" | "NEEDS_ATTENTION" | "INSUFFICIENT_DATA" }) {
  const variant = status === "IMPROVING" ? "success" : status === "NEEDS_ATTENTION" ? "danger" : "neutral";
  const label =
    status === "IMPROVING" ? "Improving" : status === "NEEDS_ATTENTION" ? "Needs attention" : status === "STABLE" ? "Stable" : "New";
  return <Badge variant={variant}>{label}</Badge>;
}
