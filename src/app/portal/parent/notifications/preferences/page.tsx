import { requireSchoolUser } from "@/lib/auth/require";
import { NotificationPreferencesContent } from "@/components/notifications/notification-preferences-content";

export default async function ParentNotificationPreferencesPage() {
  const user = await requireSchoolUser();
  return <NotificationPreferencesContent schoolId={user.schoolId} userId={user.id} backHref="/portal/parent/notifications" />;
}
