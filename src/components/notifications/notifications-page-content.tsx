import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { listNotificationsPage, hasExpiredNotifications, type NotificationListFilters } from "@/lib/services/notifications";
import { isNotificationAiConfigured } from "@/lib/services/notification-ai-summary";
import { NotificationsToolbar } from "@/components/notifications/notifications-toolbar";
import { NotificationRow } from "@/components/notifications/notification-row";
import { NotificationAiSummary } from "@/components/notifications/notification-ai-summary";

/// The brief's section 18 filter set (All/Unread/High Priority/Academic/
/// Attendance/Finance/Assignments/Exams/System), applied server-side —
/// same query param -> Server Component filter pattern already used by
/// every other paginated list in this app (e.g. /dashboard/assignments).
const TABS: { slug: string; label: string; filters: NotificationListFilters }[] = [
  { slug: "all", label: "All", filters: {} },
  { slug: "unread", label: "Unread", filters: { unreadOnly: true } },
  { slug: "high", label: "High Priority", filters: { priority: ["CRITICAL", "HIGH"] } },
  { slug: "academic", label: "Academic", filters: { category: "ACADEMIC" } },
  { slug: "attendance", label: "Attendance", filters: { category: "ATTENDANCE" } },
  { slug: "finance", label: "Finance", filters: { category: ["FEES", "PAYMENT"] } },
  { slug: "assignments", label: "Assignments", filters: { category: "ASSIGNMENT" } },
  { slug: "exams", label: "Exams", filters: { category: "EXAM" } },
  { slug: "system", label: "System", filters: { category: "SYSTEM" } },
];

/// The shared body rendered at every /notifications route (dashboard,
/// parent portal, student portal) — each route's page.tsx does its own
/// auth/role check (per that layout's own rules) and passes the resolved
/// schoolId/userId here; this component never re-derives or trusts an
/// identity of its own, only renders what it's handed.
export async function NotificationsPageContent({
  schoolId,
  userId,
  basePath,
  searchParams,
}: {
  schoolId: string;
  userId: string;
  basePath: string;
  searchParams: { tab?: string; page?: string; q?: string };
}) {
  const activeTab = TABS.find((t) => t.slug === searchParams.tab) ?? TABS[0];
  const page = searchParams.page ? Math.max(1, Number(searchParams.page) || 1) : 1;
  const search = searchParams.q?.trim() || undefined;

  const [{ items, total, totalPages }, hasExpired] = await Promise.all([
    listNotificationsPage(schoolId, userId, { ...activeTab.filters, search }, page, 20),
    hasExpiredNotifications(schoolId, userId),
  ]);
  const hasUnread = items.some((n) => !n.readAt) || activeTab.slug === "unread";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-muted">
            {total} notification{total === 1 ? "" : "s"}
            {activeTab.slug !== "all" ? ` · ${activeTab.label}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationsToolbar hasUnread={hasUnread} hasExpired={hasExpired} />
          <Link
            href={`${basePath}/preferences`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" /> Preferences
          </Link>
        </div>
      </div>

      <NotificationAiSummary aiConfigured={isNotificationAiConfigured()} />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter notifications">
        {TABS.map((tab) => (
          <Link
            key={tab.slug}
            href={{ pathname: basePath, query: { tab: tab.slug, ...(search ? { q: search } : {}) } }}
            role="tab"
            aria-selected={tab.slug === activeTab.slug}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab.slug === activeTab.slug ? "bg-accent text-white" : "bg-muted-surface text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form action={basePath} method="GET" className="flex gap-2">
        <input type="hidden" name="tab" value={activeTab.slug} />
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Search notifications"
          aria-label="Search notifications"
          className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent sm:max-w-xs"
        />
      </form>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title={search ? "No matching notifications" : "You're all caught up"}
              description={search ? "Try a different search or filter." : "New notifications about your school will show up here."}
              className="p-8"
            />
          ) : (
            <div>
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={{
                    id: n.id,
                    title: n.title,
                    body: n.body,
                    link: n.link,
                    actionLabel: n.actionLabel,
                    readAt: n.readAt,
                    createdAt: n.createdAt,
                    priority: n.priority,
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination page={page} pageCount={totalPages} basePath={basePath} query={{ tab: activeTab.slug, q: search }} />
    </div>
  );
}
