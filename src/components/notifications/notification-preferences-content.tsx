import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getNotificationPreferences, PREFERENCE_TOGGLEABLE_CATEGORIES } from "@/lib/services/notifications";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";

export async function NotificationPreferencesContent({ schoolId, userId, backHref }: { schoolId: string; userId: string; backHref: string }) {
  const preferences = await getNotificationPreferences(schoolId, userId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to notifications
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Notification preferences</h1>
        <p className="text-sm text-muted">Choose which kinds of notifications appear in your bell and notifications list.</p>
      </div>

      <Card>
        <CardContent>
          <NotificationPreferencesForm categories={PREFERENCE_TOGGLEABLE_CATEGORIES} initial={preferences} />
        </CardContent>
      </Card>
    </div>
  );
}
