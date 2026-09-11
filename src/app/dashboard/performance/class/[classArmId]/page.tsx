import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RiskBadge, TrendBadge } from "@/components/dashboard/performance-badges";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getClassPerformanceOverview } from "@/lib/services/performance/analysis";
import { PerformanceAccessDeniedError } from "@/lib/services/performance/authorization";
import { listOrderedPeriods } from "@/lib/services/performance/periods";
import { mainConcernLabel } from "@/lib/services/performance/labels";

function pct(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

export default async function ClassPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classArmId: string }>;
  searchParams: Promise<{ termId?: string }>;
}) {
  const { classArmId } = await params;
  const { termId } = await searchParams;
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const perms = await getUserPermissions(user.id);

  let overview;
  try {
    overview = await getClassPerformanceOverview(user.schoolId, user.id, perms, classArmId, termId);
  } catch (error) {
    if (error instanceof PerformanceAccessDeniedError) {
      return (
        <div className="max-w-4xl">
          <EmptyState title="Not authorized" description="You can only view performance analysis for classes you're assigned to teach." />
        </div>
      );
    }
    if (error instanceof Error && error.message === "Class not found") notFound();
    throw error;
  }

  const periods = await listOrderedPeriods(user.schoolId);

  return (
    <div className="max-w-5xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/performance" className="text-sm text-muted hover:text-accent hover:underline">
            ← Student Success
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{overview.className}</h1>
          <p className="mt-1 text-sm text-muted">{overview.termName} · {overview.studentCount} student{overview.studentCount === 1 ? "" : "s"}</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="termId" className="text-xs">Academic period</Label>
            <Select id="termId" name="termId" defaultValue={overview.termId} className="text-sm">
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
        <Button asChild variant="secondary" size="sm">
          <a href={`/api/performance/export?classArmId=${overview.classArmId}&termId=${overview.termId}`}>Export CSV</a>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Average performance" value={pct(overview.averageOverall)} />
        <Stat label="High / Critical risk" value={String(overview.riskCounts.HIGH + overview.riskCounts.CRITICAL)} />
        <Stat label="Moderate risk" value={String(overview.riskCounts.MODERATE)} />
        <Stat label="Improving" value={String(overview.trendCounts.improving)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class risk list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overview.students.length === 0 ? (
            <EmptyState className="p-8" title="No active students in this class" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Current average</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Main concern</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.students
                  .slice()
                  .sort((a, b) => b.risk.riskScore - a.risk.riskScore)
                  .map((s) => (
                    <TableRow key={s.studentId}>
                      <TableCell>
                        <Link href={`/dashboard/students/${s.studentId}/performance`} className="font-medium text-foreground hover:text-accent hover:underline">
                          {s.studentName}
                        </Link>
                        <p className="text-xs text-muted">{s.admissionNumber}</p>
                      </TableCell>
                      <TableCell className="text-muted">{pct(s.metrics.overallAverage)}</TableCell>
                      <TableCell><TrendBadge status={s.trend.status} /></TableCell>
                      <TableCell className="text-muted">{pct(s.attendance.attendanceRate)}</TableCell>
                      <TableCell><RiskBadge level={s.risk.riskLevel} /></TableCell>
                      <TableCell className="text-muted">{mainConcernLabel(s)}</TableCell>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="truncate text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
