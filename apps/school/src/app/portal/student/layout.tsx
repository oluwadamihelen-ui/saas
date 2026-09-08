import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { listNotifications, unreadNotificationCount } from "@/lib/services/notifications";
import { PortalSidebar, PortalMobileNav } from "@/components/portal/portal-sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export default async function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireSchoolUser();

  if (sessionUser.role !== "STUDENT") {
    redirect(sessionUser.role === "PARENT" ? "/portal/parent" : "/dashboard");
  }

  const [user, notifications, unreadCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } }),
    listNotifications(sessionUser.schoolId, sessionUser.id),
    unreadNotificationCount(sessionUser.schoolId, sessionUser.id),
  ]);

  return (
    <div className="flex min-h-screen">
      <PortalSidebar role="student" />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          name={user.name}
          email={user.email}
          roleName="Student"
          notifications={notifications}
          unreadCount={unreadCount}
          mobileNav={<PortalMobileNav role="student" />}
        />
        <main className="container-shell min-w-0 flex-1 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
