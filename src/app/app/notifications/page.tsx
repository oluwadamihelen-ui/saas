import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireHotelUser } from "@/lib/auth/require";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { listNotifications } from "@/lib/services/notifications";
import { MarkAllReadButton } from "./notifications-client";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireHotelUser();
  const notifications = await listNotifications(user.id, false, 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        {notifications.some((n) => !n.isRead) && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-5 py-3">
                {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                <div className={n.isRead ? "ml-5" : ""}>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-sm text-muted">{n.message}</p>
                  <p className="text-xs text-muted">{formatDate(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
