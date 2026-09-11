import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowUpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { listNotificationsPage } from "@/lib/services/notifications";

const PRIORITY_ICON = { CRITICAL: AlertTriangle, HIGH: ArrowUpCircle } as const;

/// Brief section 26's compact "Needs Attention" section, integrated into
/// each role's existing dashboard/portal home rather than a separate page
/// — reads the same Notification rows the bell and /notifications page
/// read (no separate computation), scoped to just this user's own
/// unread CRITICAL/HIGH items so the home page only ever shows what
/// genuinely needs this person's attention today, never a padded list.
export async function NeedsAttentionCard({ schoolId, userId, viewAllHref }: { schoolId: string; userId: string; viewAllHref: string }) {
  const { items, total } = await listNotificationsPage(schoolId, userId, { priority: ["CRITICAL", "HIGH"], unreadOnly: true }, 1, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs your attention</CardTitle>
        <CardDescription>{total === 0 ? "Nothing urgent right now." : `${total} item${total === 1 ? "" : "s"} need attention.`}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted">
            <CheckCircle2 className="h-5 w-5 text-success" />
            You&apos;re all caught up.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const Icon = PRIORITY_ICON[item.priority as keyof typeof PRIORITY_ICON] ?? ArrowUpCircle;
              const body = item.link ? (
                <Link href={item.link} className="font-medium text-foreground hover:text-accent">
                  {item.title}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{item.title}</span>
              );
              return (
                <li key={item.id} className="flex items-start gap-2 py-2.5 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.priority === "CRITICAL" ? "text-danger" : "text-warning"}`} aria-hidden="true" />
                  <div className="min-w-0">
                    {body}
                    {item.body && <p className="text-xs text-muted">{item.body}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {total > 0 && (
          <Link href={viewAllHref} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
            View all notifications
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
