"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  ArrowUpCircle,
  Circle,
  Info,
  BookOpen,
  ClipboardList,
  Wallet,
  CreditCard,
  CalendarClock,
  Video,
  Megaphone,
  Cake,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
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

export type NotificationPriorityValue = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type NotificationCategoryValue =
  | "ACADEMIC"
  | "ATTENDANCE"
  | "ASSIGNMENT"
  | "EXAM"
  | "RESULT"
  | "FEES"
  | "PAYMENT"
  | "ADMISSION"
  | "TIMETABLE"
  | "ONLINE_CLASS"
  | "ANNOUNCEMENT"
  | "EVENT"
  | "MESSAGING"
  | "BIRTHDAY"
  | "STAFF"
  | "HR"
  | "PAYROLL"
  | "LIBRARY"
  | "TRANSPORT"
  | "HOSTEL"
  | "INVENTORY"
  | "SYSTEM"
  | "AI_INSIGHT";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
  category: NotificationCategoryValue;
  priority: NotificationPriorityValue;
  actionLabel: string | null;
}

/// Client-side mirror of notifications.ts's NOTIFICATION_PRIORITY_ORDER —
/// duplicated rather than imported so this "use client" component never
/// pulls in the server-only notifications.ts module graph.
const PRIORITY_WEIGHT: Record<NotificationPriorityValue, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

/// Priority is never conveyed by color alone (brief section 36) — every
/// tier pairs a distinct icon with a text label.
const PRIORITY_META: Record<NotificationPriorityValue, { label: string; icon: LucideIcon; className: string }> = {
  CRITICAL: { label: "Critical", icon: AlertTriangle, className: "text-danger" },
  HIGH: { label: "High", icon: ArrowUpCircle, className: "text-warning" },
  MEDIUM: { label: "Medium", icon: Circle, className: "text-accent" },
  LOW: { label: "Low", icon: Circle, className: "text-muted" },
  INFO: { label: "Info", icon: Info, className: "text-muted" },
};

const CATEGORY_ICON: Partial<Record<NotificationCategoryValue, LucideIcon>> = {
  ACADEMIC: BookOpen,
  ATTENDANCE: Users,
  ASSIGNMENT: ClipboardList,
  EXAM: ClipboardList,
  RESULT: BookOpen,
  FEES: Wallet,
  PAYMENT: CreditCard,
  ADMISSION: Users,
  TIMETABLE: CalendarClock,
  ONLINE_CLASS: Video,
  ANNOUNCEMENT: Megaphone,
  EVENT: CalendarClock,
  MESSAGING: Megaphone,
  BIRTHDAY: Cake,
  AI_INSIGHT: Sparkles,
};

export function NotificationBell({
  notifications,
  unreadCount,
  viewAllHref,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  viewAllHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const sorted = [...notifications].sort(
    (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || b.createdAt.valueOf() - a.createdAt.valueOf()
  );

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
        <Button size="sm" variant="ghost" className="relative" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[92vw] max-w-sm sm:w-96">
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
        {sorted.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">You&apos;re all caught up.</p>
        ) : (
          sorted.slice(0, 10).map((n) => {
            const priorityMeta = PRIORITY_META[n.priority];
            const PriorityIcon = priorityMeta.icon;
            const CategoryIcon = CATEGORY_ICON[n.category] ?? Bell;
            return (
              <DropdownMenuItem key={n.id} onSelect={() => handleOpenNotification(n.id, n.readAt, n.link)}>
                <div className="flex w-full items-start gap-2">
                  {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                  <CategoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className={`min-w-0 flex-1 ${n.readAt ? "opacity-70" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                    </div>
                    {n.body && <p className="line-clamp-2 text-xs text-muted">{n.body}</p>}
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${priorityMeta.className}`}>
                        <PriorityIcon className="h-3 w-3" aria-hidden="true" />
                        {priorityMeta.label}
                      </span>
                      {n.actionLabel && <span className="text-[11px] font-medium text-accent">{n.actionLabel}</span>}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <Link
          href={viewAllHref}
          className="block px-3 py-2 text-center text-xs font-medium text-accent hover:underline"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
