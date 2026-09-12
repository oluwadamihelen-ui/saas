import { requireSchoolUser } from "@/lib/auth/require";
import { NotificationsPageContent } from "@/components/notifications/notifications-page-content";

export default async function StudentNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const user = await requireSchoolUser();
  const params = await searchParams;
  return <NotificationsPageContent schoolId={user.schoolId} userId={user.id} basePath="/portal/student/notifications" searchParams={params} />;
}
