import Link from "next/link";
import { CalendarClock, TrendingUp, Wallet, Banknote, Library, Bus, BedDouble } from "lucide-react";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getDashboardStats, getRecentlyEnrolledStudents } from "@/lib/services/dashboard";
import { getTodayAttendanceSummary } from "@/lib/services/attendance";
import { getFinanceStats } from "@/lib/services/finance-dashboard";
import { listUpcomingBirthdays } from "@/lib/services/birthdays";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { StatCard } from "@/components/dashboard/stat-card";
import { UpcomingBirthdaysWidget } from "@/components/dashboard/upcoming-birthdays-widget";
import { NeedsAttentionCard } from "@/components/notifications/needs-attention-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { cn, formatDate } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  const canViewAttendance = perms.has(PERMISSIONS.ATTENDANCE_VIEW);
  const canViewFinance = perms.has(PERMISSIONS.FINANCE_VIEW);
  const canEnroll = perms.has(PERMISSIONS.STUDENTS_CREATE);
  const canUseAssistant = perms.has(PERMISSIONS.ASSISTANT_USE);
  const canViewBirthdays = perms.has(PERMISSIONS.BIRTHDAYS_VIEW);
  const params = await searchParams;

  const operationsLinks = [
    { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, show: perms.has(PERMISSIONS.PAYROLL_VIEW) },
    { href: "/dashboard/library", label: "Library", icon: Library, show: perms.has(PERMISSIONS.LIBRARY_VIEW) },
    { href: "/dashboard/transport", label: "Transport", icon: Bus, show: perms.has(PERMISSIONS.TRANSPORT_VIEW) },
    { href: "/dashboard/hostel", label: "Hostel", icon: BedDouble, show: perms.has(PERMISSIONS.HOSTEL_VIEW) },
  ].filter((l) => l.show);

  const [stats, recentlyEnrolled, attendanceToday, school] = await Promise.all([
    getDashboardStats(user.schoolId),
    getRecentlyEnrolledStudents(user.schoolId, params.page ? Number(params.page) : 1),
    canViewAttendance ? getTodayAttendanceSummary(user.schoolId) : Promise.resolve(null),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);
  const financeStats = canViewFinance ? await getFinanceStats(user.schoolId, stats.currentTerm?.id) : null;
  const upcomingBirthdays = canViewBirthdays ? await listUpcomingBirthdays(user.schoolId, school.timezone, 7) : [];

  // Attendance, Finance, Schoolum Intelligence and Operations all fold into
  // one tabbed card — each was its own stacked card before, which pushed
  // Recently enrolled and Upcoming Birthdays further down the page than
  // either needs to be. Only tabs the user actually has permission for
  // are offered, same as the old cards only showed for those permissions.
  const tabs = [
    canViewAttendance && { value: "attendance", label: "Attendance", icon: TrendingUp },
    canViewFinance && { value: "finance", label: "Finance", icon: Wallet },
    canUseAssistant && { value: "assistant", label: "Schoolum AI", icon: CalendarClock },
    operationsLinks.length > 0 && { value: "operations", label: "Operations", icon: Banknote },
  ].filter((t): t is { value: string; label: string; icon: typeof TrendingUp } => Boolean(t));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted">
            {stats.currentSession
              ? `${stats.currentSession.name}${stats.currentTerm ? ` · ${stats.currentTerm.name}` : ""}`
              : "No active academic session"}
          </p>
        </div>
        {canEnroll && (
          <Button asChild>
            <Link href="/dashboard/students/new">Enroll a student</Link>
          </Button>
        )}
      </div>

      <NeedsAttentionCard schoolId={user.schoolId} userId={user.id} viewAllHref="/dashboard/notifications" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total students" value={stats.totalStudents} hint={`${stats.activeStudents} active`} />
        <StatCard label="Staff accounts" value={stats.totalStaff} />
        <StatCard label="Class arms" value={stats.totalClassArms} />
        <StatCard
          label="Current term"
          value={stats.currentTerm ? stats.currentTerm.name : "—"}
          hint={stats.currentTerm ? `Ends ${formatDate(stats.currentTerm.endDate)}` : undefined}
        />
      </div>

      <div className={cn("grid grid-cols-1 gap-4 sm:gap-6", canViewBirthdays && "lg:grid-cols-2")}>
        <Card>
          <CardHeader>
            <CardTitle>Recently enrolled</CardTitle>
            <CardDescription>The most recently added students — {recentlyEnrolled.total} enrolled in total.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentlyEnrolled.students.length === 0 ? (
              <EmptyState
                title="No students yet"
                description={canEnroll ? "Enroll your first student to see them here." : "No students enrolled yet."}
                action={
                  canEnroll ? (
                    <Button asChild size="sm">
                      <Link href="/dashboard/students/new">Enroll a student</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {recentlyEnrolled.students.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                      <Link href={`/dashboard/students/${s.id}`} className="font-medium text-foreground hover:text-accent">
                        {s.firstName} {s.lastName}
                      </Link>
                      <div className="flex items-center gap-3 text-muted">
                        <span>{s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : "Unassigned"}</span>
                        <Badge variant={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination page={recentlyEnrolled.page} pageCount={recentlyEnrolled.pageCount} basePath="/dashboard" />
              </>
            )}
          </CardContent>
        </Card>

        {canViewBirthdays && <UpcomingBirthdaysWidget people={upcomingBirthdays} />}
      </div>

      {tabs.length > 0 && (
        <Tabs defaultValue={tabs[0].value}>
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="inline-flex items-center gap-1.5">
                <t.icon className="h-4 w-4" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {canViewAttendance && (
            <TabsContent value="attendance">
              <Card>
                <CardContent>
                  {!attendanceToday || attendanceToday.marked === 0 ? (
                    <EmptyState
                      title="No attendance marked today"
                      description={attendanceToday ? `${attendanceToday.totalActiveStudents} active students. Mark today's attendance to see it here.` : undefined}
                      action={
                        <Button asChild size="sm">
                          <Link href="/dashboard/attendance">Mark attendance</Link>
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold text-foreground">{attendanceToday.attendanceRate}%</span>
                        <span className="text-sm text-muted">present today</span>
                      </div>
                      <p className="text-sm text-muted">
                        {attendanceToday.present} present · {attendanceToday.absent} absent ·{" "}
                        {attendanceToday.marked} of {attendanceToday.totalActiveStudents} marked
                      </p>
                      <Button asChild size="sm" variant="secondary">
                        <Link href="/dashboard/attendance">Mark attendance</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canViewFinance && (
            <TabsContent value="finance">
              <Card>
                <CardContent>
                  {!financeStats || financeStats.totalInvoices === 0 ? (
                    <EmptyState
                      title="No invoices yet"
                      description="Generate invoices for a class to start tracking revenue."
                      action={
                        <Button asChild size="sm">
                          <Link href="/dashboard/finance/invoices">Go to invoices</Link>
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold text-foreground">{formatMoney(financeStats.revenueMinor, school.currency)}</span>
                        <span className="text-sm text-muted">collected this term</span>
                      </div>
                      <p className="text-sm text-muted">
                        {formatMoney(financeStats.outstandingMinor, school.currency)} outstanding · {financeStats.overdueCount} overdue
                      </p>
                      <Button asChild size="sm" variant="secondary">
                        <Link href="/dashboard/finance">View finance</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canUseAssistant && (
            <TabsContent value="assistant">
              <Card>
                <CardContent>
                  <EmptyState
                    title="Ask Schoolum about your school"
                    description="Get answers about students, attendance, results and finance."
                    action={
                      <Button asChild size="sm">
                        <Link href="/dashboard/assistant">Open Schoolum AI</Link>
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {operationsLinks.length > 0 && (
            <TabsContent value="operations">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {operationsLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href}>
                      <Card className="transition-colors hover:border-accent">
                        <CardContent className="flex items-center gap-3 p-4">
                          <Icon className="h-5 w-5 text-accent" />
                          <span className="text-sm font-medium text-foreground">{link.label}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
