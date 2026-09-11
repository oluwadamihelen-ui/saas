"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction, clearExpiredNotificationsAction } from "@/lib/actions/notifications";

export function NotificationsToolbar({ hasUnread, hasExpired }: { hasUnread: boolean; hasExpired: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function handleClearExpired() {
    startTransition(async () => {
      await clearExpiredNotificationsAction();
      router.refresh();
    });
  }

  if (!hasUnread && !hasExpired) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {hasUnread && (
        <Button size="sm" variant="outline" onClick={handleMarkAll} disabled={isPending}>
          Mark all read
        </Button>
      )}
      {hasExpired && (
        <Button size="sm" variant="outline" onClick={handleClearExpired} disabled={isPending}>
          Clear expired
        </Button>
      )}
    </div>
  );
}
