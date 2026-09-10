import Link from "next/link";
import { CalendarClock, TrendingUp, Wallet, Banknote, Library, Bus, BedDouble, Cake } from "lucide-react";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getDashboardStats } from "@/lib/services/dashboard";
import { getTodayAttendanceSummary } from "@/lib/services/attendance";
import { getFinanceStats } from "@/lib/services/finance-dashboard";
import { getUpcomingBirthdays, type BirthdayPersonType } from "@/lib/services/birthdays";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { StatCard } from "@/components/dashboard/stat-card";
import { BirthdayList } from "@/components/dashboard/birthday-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  const canViewAttendance = perms.has(PERMISSIONS.ATTENDANCE_VIEW);
  const canViewFinance = perms.has(PERMISSIONS.FINANCE_VIEW);
  const canEnroll = perms.has(PERMISSIONS.STUDENTS_CREATE);
  const canUseAssistant = perms.has(PERMISSIONS.ASSISTANT_USE);
  const canViewStudentBirthdays = perms.has(PERMISSIONS.STUDENTS_VIEW);
  const canViewStaffBirthdays = perms.has(PERMISSIONS.STAFF_VIEW);
  const birthdayTypes: BirthdayPersonType[] = [
    ...(canViewStudentBirthdays ? (["STUDENT"] as const) : []),
    ...(canViewStaffBirthdays ? (["STAFF"] as const) : []),
  ];
  const operationsLinks = [
    { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, show: perms.has(PERMISSIONS.PAYROLL_VIEW) },
    { href: "/dashboard/library", label: "Library", icon: Library, show: perms.has(PERMISSIONS.LIBRARY_VIEW) },
    { href: "/dashboard/transport", label: "Transport", icon: Bus, show: perms.has(PERMISSIONS.TRANSPORT_VIEW) },
    { href: "/dashboard/hostel", label: "Hostel", icon: BedDouble, show: perms.has(PERMISSIONS.HOSTEL_VIEW) },
  ].filter((l) => l.show);
  const [stats, attendanceToday, school] = await Promise.all([
    getDashboardStats(user.schoolId),
    canViewAttendance ? getTodayAttendanceSummary(user.schoolId) : Promise.resolve(null),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);
  const financeStats = canViewFinance ? await getFinanceStats(user.schoolId, stats.currentTerm?.id) : null;
  const upcomingBirthdays =
    birthdayTypes.length > 0 ? await getUpcomingBirthdays(user.schoolId, school.timezone, { types: birthdayTypes, limit: 7 }) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted">
            {stats.currentSession
              ? `${stats.currentSession.name}${stats.currentTerm ? ` · ${stats.currentTerm.name}` : ""}`
              : "No active academic session"}
          </p>
        </div>
        {canEnroll && (
          <Button asChild size="sm">
            <Link href="/dashboard/students/new">Enroll a student</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compact label="Total students" value={stats.totalStudents} hint={`${stats.activeStudents} active`} />
        <StatCard compact label="Staff accounts" value={stats.totalStaff} />
        <StatCard compact label="Class arms" value={stats.totalClassArms} />
        <StatCard
          compact
          label="Current term"
          value={stats.currentTerm ? stats.currentTerm.name : "—"}
          hint={stats.currentTerm ? `Ends ${formatDate(stats.currentTerm.endDate)}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Recently enrolled</CardTitle>
            <CardDescription className="text-xs">The last few students added to the system.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats.recentStudents.length === 0 ? (
              <EmptyState
                className="py-8"
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
              <ul className="divide-y divide-border">
                {stats.recentStudents.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/dashboard/students/${s.id}`} className="font-medium text-foreground hover:text-accent">
                      {s.firstName} {s.lastName}
                    </Link>
                    <div className="flex items-center gap-3 text-muted">
                      <span className="text-xs">{s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : "Unassigned"}</span>
                      <Badge variant={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" /> Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {!attendanceToday ? (
                <EmptyState className="py-6" title="No access" description="You don't have permission to view attendance." />
              ) : attendanceToday.marked === 0 ? (
                <EmptyState
                  className="py-6"
                  title="No attendance marked today"
                  description={`${attendanceToday.totalActiveStudents} active students. Mark today's attendance to see it here.`}
                  action={
                    <Button asChild size="sm">
                      <Link href="/dashboard/attendance">Mark attendance</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold text-foreground">{attendanceToday.attendanceRate}%</span>
                    <span className="text-sm text-muted">present today</span>
                  </div>
                  <p className="text-xs text-muted">
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
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4" /> Finance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {!financeStats ? (
                <EmptyState className="py-6" title="No access" description="You don't have permission to view finance." />
              ) : financeStats.totalInvoices === 0 ? (
                <EmptyState
                  className="py-6"
                  title="No invoices yet"
                  description="Generate invoices for a class to start tracking revenue."
                  action={
                    <Button asChild size="sm">
                      <Link href="/dashboard/finance/invoices">Go to invoices</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold text-foreground">{formatMoney(financeStats.revenueMinor, school.currency)}</span>
                    <span className="text-sm text-muted">collected this term</span>
                  </div>
                  <p className="text-xs text-muted">
                    {formatMoney(financeStats.outstandingMinor, school.currency)} outstanding · {financeStats.overdueCount} overdue
                  </p>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/dashboard/finance">View finance</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4" /> AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {canUseAssistant ? (
                <EmptyState
                  className="py-6"
                  title="Ask about your school"
                  description="Get answers about students, attendance, results and finance."
                  action={
                    <Button asChild size="sm">
                      <Link href="/dashboard/assistant">Open assistant</Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState className="py-6" title="No access" description="You don't have permission to use the AI assistant." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {birthdayTypes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cake className="h-4 w-4 text-accent" /> Upcoming Birthdays
              </CardTitle>
              <CardDescription className="text-xs">The next 7 birthdays among active students and staff.</CardDescription>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/birthdays">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <BirthdayList entries={upcomingBirthdays} />
          </CardContent>
        </Card>
      )}

      {operationsLinks.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Operations</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {operationsLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <Card className="transition-colors hover:border-accent">
                    <CardContent className="flex items-center gap-2.5 p-3">
                      <Icon className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium text-foreground">{link.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
