import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { getSchool } from "@/lib/services/school";
import { listNotifications, unreadNotificationCount } from "@/lib/services/notifications";
import { maybeRunNotificationRules } from "@/lib/services/notification-rules";
import { PortalSidebar, PortalMobileNav } from "@/components/portal/portal-sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { BrandStyle } from "@/components/brand/brand-style";

export default async function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireSchoolUser();

  if (sessionUser.role !== "STUDENT") {
    redirect(sessionUser.role === "PARENT" ? "/portal/parent" : "/dashboard");
  }

  await maybeRunNotificationRules(sessionUser.schoolId);

  const [user, school, notifications, unreadCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } }),
    getSchool(sessionUser.schoolId),
    listNotifications(sessionUser.schoolId, sessionUser.id),
    unreadNotificationCount(sessionUser.schoolId, sessionUser.id),
  ]);
  const schoolBrief = { name: school.name, logoUrl: school.logoUrl };

  return (
    <div className="flex min-h-screen">
      <BrandStyle color={school.brandColor} />
      <PortalSidebar role="student" school={schoolBrief} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          name={user.name}
          email={user.email}
          roleName="Student"
          notifications={notifications}
          unreadCount={unreadCount}
          notificationsHref="/portal/student/notifications"
          mobileNav={<PortalMobileNav role="student" school={schoolBrief} />}
        />
        <main className="container-shell min-w-0 flex-1 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
