"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpCircle, Circle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationReadAction, deleteNotificationAction } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/utils";

type PriorityValue = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

const PRIORITY_META: Record<PriorityValue, { label: string; icon: typeof AlertTriangle; className: string }> = {
  CRITICAL: { label: "Critical", icon: AlertTriangle, className: "text-danger" },
  HIGH: { label: "High", icon: ArrowUpCircle, className: "text-warning" },
  MEDIUM: { label: "Medium", icon: Circle, className: "text-accent" },
  LOW: { label: "Low", icon: Circle, className: "text-muted" },
  INFO: { label: "Info", icon: Info, className: "text-muted" },
};

export interface NotificationRowData {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  actionLabel: string | null;
  readAt: Date | null;
  createdAt: Date;
  priority: PriorityValue;
}

export function NotificationRow({ notification }: { notification: NotificationRowData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const priorityMeta = PRIORITY_META[notification.priority];
  const PriorityIcon = priorityMeta.icon;

  function handleOpen() {
    startTransition(async () => {
      if (!notification.readAt) await markNotificationReadAction(notification.id);
      if (notification.link) router.push(notification.link);
      else router.refresh();
    });
  }

  function handleMarkRead(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await markNotificationReadAction(notification.id);
      router.refresh();
    });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await deleteNotificationAction(notification.id);
      router.refresh();
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
      aria-current={!notification.readAt ? "true" : undefined}
      className={`flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 outline-none last:border-0 hover:bg-muted-surface focus-visible:bg-muted-surface ${
        notification.readAt ? "opacity-70" : ""
      }`}
    >
      {!notification.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{notification.title}</p>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${priorityMeta.className}`}>
            <PriorityIcon className="h-3 w-3" aria-hidden="true" />
            {priorityMeta.label}
          </span>
        </div>
        {notification.body && <p className="mt-0.5 text-sm text-muted">{notification.body}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>{formatDateTime(notification.createdAt)}</span>
          {notification.actionLabel && <span className="font-medium text-accent">{notification.actionLabel}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!notification.readAt && (
          <Button size="sm" variant="ghost" onClick={handleMarkRead} disabled={isPending} aria-label="Mark as read">
            Mark read
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending} aria-label="Delete notification">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
