import Link from "next/link";
import { CalendarClock, TrendingUp, Wallet } from "lucide-react";
import { requireSchoolUser } from "@/lib/auth/require";
import { getDashboardStats } from "@/lib/services/dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireSchoolUser();
  const stats = await getDashboardStats(user.schoolId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted">
            {stats.currentSession
              ? `${stats.currentSession.name}${stats.currentTerm ? ` · ${stats.currentTerm.name}` : ""}`
              : "No active academic session"}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/students/new">Enroll a student</Link>
        </Button>
      </div>

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recently enrolled</CardTitle>
            <CardDescription>The last few students added to the system.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentStudents.length === 0 ? (
              <EmptyState
                title="No students yet"
                description="Enroll your first student to see them here."
                action={
                  <Button asChild size="sm">
                    <Link href="/dashboard/students/new">Enroll a student</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {stats.recentStudents.map((s) => (
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
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" /> Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState title="Coming in Phase 2" description="Attendance tracking and trends will show here once it's built." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4" /> Finance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState title="Coming in Phase 3" description="Fees, invoices and revenue will show here once billing is built." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4" /> AI insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState title="Coming in Phase 5" description="AI-generated insights need attendance and results data to reason over." />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
