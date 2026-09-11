"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/actions/notifications";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /// Marking read and navigating both need to happen from the same click.
  /// Two earlier shapes of this both raced router.push against
  /// router.refresh (issuing a competing fetch for the *current* route
  /// segment tree right as the push to a new route was starting) and the
  /// refresh would win, silently discarding the pending navigation — so
  /// clicking a notification just stayed on the same page. Only refresh
  /// when we're NOT navigating away: /dashboard and
  /// /dashboard/administration/feedback (etc.) share DashboardLayout, so
  /// push() alone already gets the destination page fresh data; the
  /// shared layout's own bell count simply catches up on its next normal
  /// navigation rather than needing a forced refresh right here.
  function handleOpenNotification(id: string, readAt: Date | null, link: string | null) {
    startTransition(async () => {
      if (!readAt) await markNotificationReadAction(id);
      if (link) {
        router.push(link);
      } else {
        router.refresh();
      }
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={isPending}
              className="text-xs font-medium text-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {notifications.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">You&apos;re all caught up.</p>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem key={n.id} onSelect={() => handleOpenNotification(n.id, n.readAt, n.link)}>
              <div className="flex items-start gap-2">
                {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                <div className={n.readAt ? "opacity-70" : ""}>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="text-xs text-muted">{n.body}</p>}
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
