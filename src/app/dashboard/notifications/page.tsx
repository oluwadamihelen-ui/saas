import { requireSchoolUser } from "@/lib/auth/require";
import { NotificationsPageContent } from "@/components/notifications/notifications-page-content";

export default async function DashboardNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const user = await requireSchoolUser();
  const params = await searchParams;
  return <NotificationsPageContent schoolId={user.schoolId} userId={user.id} basePath="/dashboard/notifications" searchParams={params} />;
}
