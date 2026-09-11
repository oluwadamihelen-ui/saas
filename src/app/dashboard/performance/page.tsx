import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RiskBadge } from "@/components/dashboard/performance-badges";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getSchoolPerformanceOverview } from "@/lib/services/performance/analysis";
import { getAccessibleClassArmIds } from "@/lib/services/performance/authorization";
import { listOrderedPeriods } from "@/lib/services/performance/periods";
import { mainConcernLabel } from "@/lib/services/performance/labels";

function pct(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

function changeLabel(v: number | null): string {
  if (v === null) return "—";
  return v > 0 ? `+${v} pts` : `${v} pts`;
}

export default async function StudentSuccessPage({ searchParams }: { searchParams: Promise<{ termId?: string }> }) {
  const { termId } = await searchParams;
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const perms = await getUserPermissions(user.id);

  const access = await getAccessibleClassArmIds(user.schoolId, user.id, perms);

  // A teacher (not administration-tier) never sees a school-wide rollup —
  // just their own classes, each a doorway into the same class dashboard
  // an admin would drill into (brief: "Do not allow arbitrary access to
  // all students").
  if (access !== "ALL") {
    const classArms = await prisma.classArm.findMany({
      where: { schoolId: user.schoolId, id: { in: Array.from(access) } },
      include: { classGroup: true, _count: { select: { students: true } } },
      orderBy: [{ classGroup: { order: "asc" } }, { name: "asc" }],
    });

    return (
      <div className="max-w-3xl space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Student Success</h1>
          <p className="text-sm text-muted">Performance analysis for the classes you teach.</p>
        </div>
        {classArms.length === 0 ? (
          <EmptyState title="No classes assigned" description="You're not currently assigned to teach any class." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {classArms.map((c) => (
              <Link key={c.id} href={`/dashboard/performance/class/${c.id}`}>
                <Card className="transition-colors hover:border-accent">
                  <CardContent className="py-4">
                    <p className="font-medium text-foreground">{c.classGroup.name} {c.name}</p>
                    <p className="text-sm text-muted">{c._count.students} student{c._count.students === 1 ? "" : "s"}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const overview = await getSchoolPerformanceOverview(user.schoolId, user.id, perms, termId);
  const periods = await listOrderedPeriods(user.schoolId);

  return (
    <div className="max-w-6xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Student Success</h1>
          <p className="mt-1 text-sm text-muted">{overview.termName} · School-wide academic intelligence overview</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
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
            <Link href="/dashboard/performance/subject">Subject intelligence</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Students analyzed" value={String(overview.studentsAnalyzed)} />
        <Stat label="High risk" value={String(overview.riskCounts.HIGH)} />
        <Stat label="Critical risk" value={String(overview.riskCounts.CRITICAL)} />
        <Stat label="Moderate risk" value={String(overview.riskCounts.MODERATE)} />
        <Stat label="Avg performance" value={pct(overview.averageOverall)} />
        <Stat label="Avg attendance" value={pct(overview.averageAttendance)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Students requiring attention</CardTitle>
            <CardDescription>Highest risk score first.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {overview.highRiskStudents.length === 0 ? (
              <EmptyState className="p-6" title="No students currently meet the selected risk criteria." />
            ) : (
              <ul className="divide-y divide-border">
                {overview.highRiskStudents.map((s) => (
                  <li key={s.studentId} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/dashboard/students/${s.studentId}/performance`} className="font-medium text-foreground hover:text-accent hover:underline">
                        {s.studentName}
                      </Link>
                      <p className="truncate text-xs text-muted">{s.className ?? "Unassigned"} · {mainConcernLabel(s)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-muted">{pct(s.metrics.overallAverage)}</span>
                      <RiskBadge level={s.risk.riskLevel} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most improved</CardTitle>
            <CardDescription>Largest term-over-term gain first.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {overview.mostImprovedStudents.length === 0 ? (
              <EmptyState className="p-6" title="No students show significant improvement this period." />
            ) : (
              <ul className="divide-y divide-border">
                {overview.mostImprovedStudents.map((s) => (
                  <li key={s.studentId} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/dashboard/students/${s.studentId}/performance`} className="font-medium text-foreground hover:text-accent hover:underline">
                        {s.studentName}
                      </Link>
                      <p className="truncate text-xs text-muted">{s.className ?? "Unassigned"}</p>
                    </div>
                    <Badge variant="success">{changeLabel(s.trend.changePoints)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overview.classes.length === 0 ? (
            <EmptyState className="p-8" title="No classes configured yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Average</TableHead>
                  <TableHead>High / Critical</TableHead>
                  <TableHead>Improving</TableHead>
                  <TableHead>Declining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.classes.map((c) => (
                  <TableRow key={c.classArmId}>
                    <TableCell>
                      <Link href={`/dashboard/performance/class/${c.classArmId}`} className="font-medium text-foreground hover:text-accent hover:underline">
                        {c.className}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted">{c.studentCount}</TableCell>
                    <TableCell className="text-muted">{pct(c.averageOverall)}</TableCell>
                    <TableCell className="text-muted">{c.riskCounts.HIGH + c.riskCounts.CRITICAL}</TableCell>
                    <TableCell className="text-muted">{c.trendCounts.improving}</TableCell>
                    <TableCell className="text-muted">{c.trendCounts.declining}</TableCell>
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
