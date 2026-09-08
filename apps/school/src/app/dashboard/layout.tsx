import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { prisma } from "@/lib/db";
import { getSchool, nextOnboardingStep } from "@/lib/services/school";
import { listNotifications, unreadNotificationCount } from "@/lib/services/notifications";
import { Sidebar, DashboardMobileNav } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireSchoolUser();

  if (sessionUser.role === "PARENT" || sessionUser.role === "STUDENT") {
    redirect("/portal");
  }

  const school = await getSchool(sessionUser.schoolId);

  if (nextOnboardingStep(school) !== "done") {
    redirect("/onboarding");
  }

  const [user, notifications, unreadCount, perms] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id }, include: { role: true } }),
    listNotifications(sessionUser.schoolId, sessionUser.id),
    unreadNotificationCount(sessionUser.schoolId, sessionUser.id),
    getUserPermissions(sessionUser.id),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar perms={[...perms]} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          name={user.name}
          email={user.email}
          roleName={user.role.name}
          notifications={notifications}
          unreadCount={unreadCount}
          mobileNav={<DashboardMobileNav perms={[...perms]} />}
        />
        <main className="container-shell min-w-0 flex-1 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
