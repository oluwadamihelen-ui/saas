import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HealthLevelBadge, ActionPriorityBadge, HealthTrendBadge } from "@/components/dashboard/health-badges";
import { StatCard } from "@/components/dashboard/stat-card";
import { PerformanceTrendChart } from "@/components/dashboard/performance-trend-chart";
import { PaymentTrendChart } from "@/components/dashboard/payment-trend-chart";
import { UpcomingBirthdaysWidget } from "@/components/dashboard/upcoming-birthdays-widget";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { prisma } from "@/lib/db";
import { getSchoolHealthDashboard, SchoolHealthAccessDeniedError } from "@/lib/services/school-health/analysis";
import { isSchoolHealthAiConfigured } from "@/lib/services/school-health/ai-insight";
import { listOrderedPeriods } from "@/lib/services/performance/periods";
import { listUpcomingBirthdays } from "@/lib/services/birthdays";
import { listCalendarEvents } from "@/lib/services/calendar";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { AiInsightCard } from "./ai-insight-card";

function pct(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}
function changeLabel(v: number | null): string {
  if (v === null) return "—";
  return v > 0 ? `+${v} pts` : `${v} pts`;
}
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default async function SchoolHealthPage({ searchParams }: { searchParams: Promise<{ termId?: string }> }) {
  const { termId } = await searchParams;
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);

  let dashboard;
  try {
    dashboard = await getSchoolHealthDashboard(user.schoolId, user.id, perms, termId);
  } catch (error) {
    if (error instanceof SchoolHealthAccessDeniedError) {
      return (
        <div className="max-w-3xl">
          <EmptyState
            title="Not authorized"
            description="The School Health Dashboard is available to school leadership with both academic and financial oversight permissions."
          />
        </div>
      );
    }
    throw error;
  }

  const [periods, school, events] = await Promise.all([
    listOrderedPeriods(user.schoolId),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId }, select: { timezone: true, currency: true } }),
    listCalendarEvents(user.schoolId, 1),
  ]);
  const birthdays = await listUpcomingBirthdays(user.schoolId, school.timezone, 7);
  const currency = school.currency;

  return (
    <div className="max-w-6xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{greeting()}, {user.name ?? "there"}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">School Health</h1>
          {dashboard.period ? (
            <p className="mt-1 text-sm text-muted">
              {dashboard.period.academicSessionName} — {dashboard.period.termName} · Data updated {formatDateTime(dashboard.generatedAt)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">No active academic term configured.</p>
          )}
        </div>
        {periods.length > 0 && (
          <form method="get" className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="termId" className="text-xs">Academic period</Label>
              <Select id="termId" name="termId" defaultValue={dashboard.period?.termId ?? ""} className="text-sm">
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
        )}
      </div>

      {/* ---- Overall School Health ---- */}
      <Card>
        <CardHeader>
          <CardTitle>School Health Overview</CardTitle>
          {dashboard.healthScore.completeness === "PARTIAL" && (
            <CardDescription>Partial School Health Score — based on the available components only.</CardDescription>
          )}
          {dashboard.healthScore.completeness === "MOSTLY_COMPLETE" && (
            <CardDescription>
              Based on {dashboard.healthScore.components.filter((c) => c.availability === "AVAILABLE").length} of 4 components — one area doesn&apos;t have enough data yet.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard.healthScore.completeness === "NO_DATA" ? (
            <EmptyState title="Not enough data yet to calculate a School Health Score" description="Once results, attendance, or financial records exist for this period, they'll appear here." />
          ) : dashboard.healthScore.completeness === "SINGLE_COMPONENT" ? (
            <div className="space-y-3">
              <EmptyState title="Not enough data yet for a full School Health Score" description="Only one area currently has data — shown below instead of an overall score." />
              {dashboard.healthScore.components
                .filter((c) => c.availability === "AVAILABLE")
                .map((c) => (
                  <div key={c.key} className="flex items-center justify-between rounded-md border border-border p-3">
                    <span className="text-sm font-medium text-foreground">{c.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-foreground">{c.score}/100</span>
                      {c.level && <HealthLevelBadge level={c.level} />}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-foreground">{dashboard.healthScore.overallScore}</span>
                  <span className="text-lg text-muted">/ 100</span>
                </div>
                {dashboard.healthScore.overallLevel && <HealthLevelBadge level={dashboard.healthScore.overallLevel} />}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {dashboard.healthScore.components.map((c) => (
                  <div key={c.key} className="rounded-md border border-border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{c.label}</p>
                    {c.availability === "AVAILABLE" && c.score !== null ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xl font-semibold text-foreground">{c.score}</span>
                        {c.level && <HealthLevelBadge level={c.level} />}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted">
                        {c.availability === "NOT_APPLICABLE" ? "Not used by this school" : c.availability === "UNAVAILABLE" ? "Not available" : "Insufficient data"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---- Key Metrics ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active Students" value={dashboard.enrollment.currentActiveStudents.toLocaleString()} />
        <StatCard label="Active Staff" value={dashboard.staff.totalActiveStaff.toLocaleString()} />
        <StatCard label="Academic Average" value={pct(dashboard.academic.averageOverall)} />
        <StatCard label="Student Attendance" value={pct(dashboard.attendance.attendanceRate)} />
        <StatCard label="Fees Collected" value={dashboard.financial.availability === "AVAILABLE" ? formatMoney(dashboard.financial.collectedMinor, currency) : "—"} />
        <StatCard label="Outstanding Fees" value={dashboard.financial.availability === "AVAILABLE" ? formatMoney(dashboard.financial.outstandingMinor, currency) : "—"} />
      </div>

      {/* ---- Requires Attention ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Requires Attention</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.actionItems.length === 0 ? (
            <EmptyState title="No significant issues currently require your attention." />
          ) : (
            <ul className="divide-y divide-border">
              {dashboard.actionItems.map((item, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-start gap-3">
                    <ActionPriorityBadge priority={item.priority} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted">{item.description}</p>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={item.href}>View &rarr;</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isSchoolHealthAiConfigured() && dashboard.period && (
        <AiInsightCard termId={dashboard.period.termId} />
      )}

      {/* ---- Academic Health ---- */}
      <Card>
        <CardHeader><CardTitle>Academic Health</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {dashboard.academic.availability !== "AVAILABLE" ? (
            <EmptyState title="No academic results are available for the selected period." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryStat label="Average performance" value={pct(dashboard.academic.averageOverall)} />
                <SummaryStat label="Previous term" value={pct(dashboard.academic.previousAverage)} />
                <SummaryStat label="Change" value={changeLabel(dashboard.academic.changePoints)} />
                <div>
                  <p className="text-xs text-muted">Trend</p>
                  <HealthTrendBadge status={dashboard.academic.trend} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted">Students improving: <strong className="text-foreground">{dashboard.academic.studentsImproving}</strong></span>
                <span className="text-muted">Requiring attention: <strong className="text-foreground">{dashboard.academic.studentsRequiringAttention}</strong></span>
              </div>
              {dashboard.academic.primaryConcern && (
                <p className="text-sm text-muted">
                  Primary concern: <Link href={`/dashboard/performance/class/${dashboard.academic.primaryConcern.classArmId}`} className="text-accent hover:underline">
                    {dashboard.academic.primaryConcern.label}
                  </Link> averaging {dashboard.academic.primaryConcern.averageOverall}%
                </p>
              )}
              <Button asChild variant="secondary" size="sm">
                <Link href={`/dashboard/performance${dashboard.period ? `?termId=${dashboard.period.termId}` : ""}`}>View Student Success &rarr;</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---- Attendance Health ---- */}
      <Card>
        <CardHeader><CardTitle>Attendance Health</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Today</p>
            {dashboard.operational.attendanceCompletionToday.availability === "AVAILABLE" ? (
              <p className="text-sm text-foreground">
                {dashboard.operational.attendanceCompletionToday.classesCompleted} / {dashboard.operational.attendanceCompletionToday.classesTotal} classes completed
                {dashboard.operational.attendanceCompletionToday.classesCompleted < dashboard.operational.attendanceCompletionToday.classesTotal && (
                  <span className="text-warning"> — {dashboard.operational.attendanceCompletionToday.classesTotal - dashboard.operational.attendanceCompletionToday.classesCompleted} still pending</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted">No classes with students yet.</p>
            )}
          </div>
          {dashboard.attendance.availability !== "AVAILABLE" ? (
            <EmptyState title="Attendance has not yet been recorded for this academic period." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryStat label="Term attendance rate" value={pct(dashboard.attendance.attendanceRate)} />
                <SummaryStat label="Previous term" value={pct(dashboard.attendance.previousAttendanceRate)} />
                <SummaryStat label="Change" value={changeLabel(dashboard.attendance.changePoints)} />
                <div>
                  <p className="text-xs text-muted">Trend</p>
                  <HealthTrendBadge status={dashboard.attendance.trend} />
                </div>
              </div>
              {dashboard.attendance.lowestAttendanceClass && (
                <p className="text-sm text-muted">
                  Lowest attendance:{" "}
                  <Link href={`/dashboard/attendance?classArmId=${dashboard.attendance.lowestAttendanceClass.classArmId}`} className="text-accent hover:underline">
                    {dashboard.attendance.lowestAttendanceClass.className}
                  </Link>{" "}
                  ({dashboard.attendance.lowestAttendanceClass.rate}%)
                </p>
              )}
              {dashboard.attendance.studentsWithConcern > 0 && (
                <p className="text-sm text-muted">{dashboard.attendance.studentsWithConcern} student{dashboard.attendance.studentsWithConcern === 1 ? "" : "s"} with attendance concerns this term.</p>
              )}
            </>
          )}
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/attendance">View Attendance &rarr;</Link>
          </Button>
        </CardContent>
      </Card>

      {/* ---- Financial Health ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Health</CardTitle>
          {dashboard.period && <CardDescription>{dashboard.period.academicSessionName} — {dashboard.period.termName}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard.financial.availability !== "AVAILABLE" ? (
            <EmptyState title="No financial records are available for this period." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryStat label="Expected" value={formatMoney(dashboard.financial.expectedMinor, currency)} />
                <SummaryStat label="Collected" value={formatMoney(dashboard.financial.collectedMinor, currency)} />
                <SummaryStat label="Outstanding" value={formatMoney(dashboard.financial.outstandingMinor, currency)} />
                <SummaryStat label="Collection rate" value={pct(dashboard.financial.collectionRatePercent)} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted">
                <span>Overdue invoices: <strong className="text-foreground">{dashboard.financial.overdueInvoiceCount}</strong></span>
                <span>Approved expenses: <strong className="text-foreground">{formatMoney(dashboard.financial.approvedExpensesMinor, currency)}</strong></span>
                <span>Pending approvals: <strong className="text-foreground">{dashboard.financial.pendingExpenseApprovals + dashboard.financial.pendingPaymentApprovals}</strong></span>
              </div>
              {dashboard.financial.paymentTrend.length > 0 && <PaymentTrendChart points={dashboard.financial.paymentTrend} currency="₦" />}
            </>
          )}
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/finance">View Finance &rarr;</Link>
          </Button>
        </CardContent>
      </Card>

      {/* ---- Operational Health ---- */}
      <Card>
        <CardHeader><CardTitle>Operational Health</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Report Card Status</p>
              {dashboard.operational.resultCompletion.availability === "AVAILABLE" ? (
                <p className="mt-1 text-sm text-foreground">
                  Approved: {dashboard.operational.resultCompletion.studentsApproved} / {dashboard.operational.resultCompletion.studentsTotal} students
                  {" "}({dashboard.operational.resultCompletion.ratePercent}%)
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">No results recorded for this period yet.</p>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Admissions</p>
              {dashboard.operational.admissions.availability === "AVAILABLE" ? (
                <p className="mt-1 text-sm text-foreground">{dashboard.operational.admissions.pending} application{dashboard.operational.admissions.pending === 1 ? "" : "s"} pending</p>
              ) : (
                <p className="mt-1 text-sm text-muted">Not used by this school.</p>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Online Learning</p>
              {dashboard.operational.onlineLearning.availability === "AVAILABLE" ? (
                <p className="mt-1 text-sm text-foreground">
                  {dashboard.operational.onlineLearning.liveClassesToday} today · {dashboard.operational.onlineLearning.liveClassesUpcoming} in the next 7 days
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">Not used by this school.</p>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Staff Attendance</p>
              <p className="mt-1 text-sm text-muted">Not available.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Trends ---- */}
      {dashboard.academic.availability === "AVAILABLE" && dashboard.academic.previousAverage !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Academic Trend</CardTitle>
            <CardDescription>Current term compared with the previous comparable term.</CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceTrendChart
              points={[
                { label: "Previous term", average: dashboard.academic.previousAverage },
                { label: dashboard.period?.termName ?? "Current term", average: dashboard.academic.averageOverall },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* ---- Upcoming ---- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-accent" /> Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            {events.events.length === 0 ? (
              <EmptyState title="No upcoming events." />
            ) : (
              <ul className="divide-y divide-border">
                {events.events.slice(0, 5).map((e) => (
                  <li key={e.id} className="py-2.5">
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    <p className="text-xs text-muted">{formatDate(e.startAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Link href="/dashboard/administration/calendar" className="text-sm text-accent hover:underline">View calendar &rarr;</Link>
            </div>
          </CardContent>
        </Card>

        <UpcomingBirthdaysWidget people={birthdays} />
      </div>

      {dashboard.enrollment.growthAvailability === "AVAILABLE" || dashboard.enrollment.currentActiveStudents > 0 ? (
        <Card>
          <CardHeader><CardTitle>Enrollment</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryStat label="Active students" value={dashboard.enrollment.currentActiveStudents.toLocaleString()} />
              <SummaryStat label="New this session" value={dashboard.enrollment.newStudentsThisSession.toLocaleString()} />
              <SummaryStat label="Left this session" value={dashboard.enrollment.studentsLeftThisSession.toLocaleString()} />
              <SummaryStat
                label="Growth vs previous session"
                value={dashboard.enrollment.growthAvailability === "AVAILABLE" ? `${dashboard.enrollment.growthPercent! > 0 ? "+" : ""}${dashboard.enrollment.growthPercent}%` : "Insufficient historical data"}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
