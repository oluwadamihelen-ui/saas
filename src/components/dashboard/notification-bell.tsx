"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

  function handleOpenNotification(id: string, readAt: Date | null) {
    if (readAt) return;
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
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
          notifications.map((n) => {
            const content = (
              <div className="flex items-start gap-2">
                {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                <div className={n.readAt ? "opacity-70" : ""}>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="text-xs text-muted">{n.body}</p>}
                </div>
              </div>
            );
            return (
              <DropdownMenuItem key={n.id} asChild onSelect={() => handleOpenNotification(n.id, n.readAt)}>
                {n.link ? <Link href={n.link}>{content}</Link> : <div>{content}</div>}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
