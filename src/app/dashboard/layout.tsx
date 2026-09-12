import { redirect } from "next/navigation";
import { requireUser, requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { prisma } from "@/lib/db";
import { getSchool, nextOnboardingStep } from "@/lib/services/school";
import { listNotifications, unreadNotificationCount } from "@/lib/services/notifications";
import { maybeRunNotificationRules } from "@/lib/services/notification-rules";
import { Sidebar, DashboardMobileNav } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { BrandStyle } from "@/components/brand/brand-style";
import { TrialBanner } from "@/components/billing/trial-banner";
import { getEffectiveSubscription } from "@/lib/billing/entitlements";
import { PERMISSIONS } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Checked before requireSchoolUser(), which would otherwise throw for a
  // Super Admin — that account has no schoolId by design.
  const rawUser = await requireUser();
  if (rawUser.role === "SUPER_ADMIN") {
    redirect("/platform");
  }

  const sessionUser = await requireSchoolUser();

  if (sessionUser.role === "PARENT" || sessionUser.role === "STUDENT") {
    redirect("/portal");
  }

  const school = await getSchool(sessionUser.schoolId);

  if (nextOnboardingStep(school) !== "done") {
    redirect("/onboarding");
  }

  // Lazy, throttled rule scan — see notification-rules.ts's doc comment
  // for why this runs on page load rather than a cron job. Awaited so a
  // freshly-generated notification is visible in this same request's
  // bell/list below, not just from the next navigation onward.
  await maybeRunNotificationRules(sessionUser.schoolId);

  const [user, notifications, unreadCount, perms, effectiveSubscription] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id }, include: { role: true } }),
    listNotifications(sessionUser.schoolId, sessionUser.id),
    unreadNotificationCount(sessionUser.schoolId, sessionUser.id),
    getUserPermissions(sessionUser.id),
    getEffectiveSubscription(sessionUser.schoolId),
  ]);

  return (
    <div className="flex min-h-screen">
      <BrandStyle color={school.brandColor} />
      <Sidebar perms={[...perms]} school={{ name: school.name, logoUrl: school.logoUrl }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          name={user.name}
          email={user.email}
          roleName={user.role.name}
          notifications={notifications}
          unreadCount={unreadCount}
          mobileNav={<DashboardMobileNav perms={[...perms]} school={{ name: school.name, logoUrl: school.logoUrl }} />}
        />
        <TrialBanner effective={effectiveSubscription} canViewBilling={perms.has(PERMISSIONS.BILLING_VIEW)} />
        <main className="container-shell min-w-0 flex-1 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
