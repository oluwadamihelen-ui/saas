import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PerformanceTrendChart } from "@/components/dashboard/performance-trend-chart";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects } from "@/lib/services/academics";
import { getSubjectPerformanceIntelligence } from "@/lib/services/performance/subject-intelligence";
import { PerformanceAccessDeniedError } from "@/lib/services/performance/authorization";
import { listOrderedPeriods } from "@/lib/services/performance/periods";

function pct(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

export default async function SubjectPerformanceIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ subjectId?: string; termId?: string }>;
}) {
  const { subjectId, termId } = await searchParams;
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const perms = await getUserPermissions(user.id);

  const subjects = await listSubjects(user.schoolId);
  const resolvedSubjectId = subjectId || subjects[0]?.id;

  if (!resolvedSubjectId) {
    return (
      <div className="max-w-3xl">
        <EmptyState title="No subjects configured yet" />
      </div>
    );
  }

  let intelligence;
  try {
    intelligence = await getSubjectPerformanceIntelligence(user.schoolId, user.id, perms, resolvedSubjectId, termId);
  } catch (error) {
    if (error instanceof PerformanceAccessDeniedError) {
      return (
        <div className="max-w-3xl">
          <EmptyState title="Not authorized" description="Subject performance intelligence spans every class and is available to administrators only." />
        </div>
      );
    }
    // subjectId is user-suppliable via the query string — a foreign or
    // stale id correctly 404s rather than throwing unhandled, the same
    // as every other performance page's not-found handling.
    if (error instanceof Error && error.message === "Subject not found.") notFound();
    throw error;
  }

  const periods = await listOrderedPeriods(user.schoolId);
  const chartPoints = intelligence.trend.map((t) => ({ label: `${t.period.academicSessionName} ${t.period.termName}`, average: t.average }));

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/performance" className="text-sm text-muted hover:text-accent hover:underline">
            ← Student Success
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subject Performance Intelligence</h1>
          <p className="mt-1 text-sm text-muted">{intelligence.termName}</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="subjectId" className="text-xs">Subject</Label>
            <Select id="subjectId" name="subjectId" defaultValue={resolvedSubjectId} className="text-sm">
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="termId" className="text-xs">Academic period</Label>
            <Select id="termId" name="termId" defaultValue={intelligence.termId} className="text-sm">
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

      {intelligence.concernNote && (
        <Card className="border-warning/30 bg-warning-soft">
          <CardContent className="py-3 text-sm text-warning">{intelligence.concernNote}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{intelligence.subjectName} — school-wide trend</CardTitle>
          <CardDescription>Average across every class, term by term.</CardDescription>
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
          <CardTitle>By class</CardTitle>
          <CardDescription>{intelligence.termName} — {intelligence.subjectName} average per class.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {intelligence.byClassGroup.length === 0 ? (
            <EmptyState className="p-8" title="No results are available for this academic period." />
          ) : (
            <ul className="divide-y divide-border">
              {intelligence.byClassGroup.map((row) => (
                <li key={row.classGroupId} className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium text-foreground">{row.classGroupName}</span>
                  <div className="flex items-center gap-3 text-muted">
                    <span>{row.studentCount} student{row.studentCount === 1 ? "" : "s"}</span>
                    <Badge variant="accent">{pct(row.average)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
