import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getOnlineLearningOverview } from "@/lib/services/lectures";

export default async function OnlineLearningAdminOverviewPage() {
  const user = await requirePermission(PERMISSIONS.ONLINE_LEARNING_VIEW_ALL);
  const overview = await getOnlineLearningOverview(user.schoolId);

  const stats = [
    { label: "Total lectures", value: overview.totalLectures },
    { label: "Published lectures", value: overview.publishedLectures },
    { label: "Active teachers", value: overview.activeTeachers },
    { label: "Students learning", value: overview.studentsLearning },
    { label: "Average lecture completion", value: `${overview.averageCompletionRate}%` },
    { label: "Upcoming live classes", value: overview.upcomingLiveClasses },
    { label: "Live classes held", value: overview.liveClassesHeld },
    { label: "Live class attendance rate", value: `${overview.liveClassAttendanceRate}%` },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Online Learning — Overview</h1>
        <p className="text-sm text-muted">School-wide activity across self-paced lectures and live classes.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-sm font-medium text-accent">
        <Link href="/dashboard/online-learning/admin/lectures" className="hover:underline">Lectures →</Link>
        <Link href="/dashboard/online-learning/admin/live-classes" className="hover:underline">Live Classes →</Link>
        <Link href="/dashboard/online-learning/admin/teacher-activity" className="hover:underline">Teacher Activity →</Link>
        <Link href="/dashboard/online-learning/admin/student-engagement" className="hover:underline">Student Engagement →</Link>
      </div>
    </div>
  );
}
