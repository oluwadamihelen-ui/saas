import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listFeedback } from "@/lib/services/feedback";
import { formatDate } from "@/lib/utils";
import { SubmitFeedbackForm } from "./submit-form";
import { MarkReviewedButton } from "./mark-reviewed-button";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.FEEDBACK_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.FEEDBACK_MANAGE);
  const params = await searchParams;

  const { items, total, page, pageCount } = await listFeedback(user.schoolId, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feedback</h1>
        <p className="text-sm text-muted">{total} submission{total === 1 ? "" : "s"} from staff and parents</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Share feedback</CardTitle>
          <CardDescription>Anyone signed in can submit — staff, parents and students.</CardDescription>
        </CardHeader>
        <CardContent><SubmitFeedbackForm /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All submissions</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-0">
          {items.length === 0 ? (
            <EmptyState title="No feedback yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((f) => (
                <li key={f.id} className="space-y-2 p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{f.submittedBy.name}</p>
                      <p className="text-xs text-muted">{f.submittedBy.role.name} · {formatDate(f.createdAt)}</p>
                    </div>
                    <Badge variant={f.status === "REVIEWED" ? "success" : "warning"}>{f.status}</Badge>
                  </div>
                  <p className="text-foreground">{f.message}</p>
                  {canManage && f.status === "NEW" && <MarkReviewedButton id={f.id} />}
                  {f.reviewedBy && <p className="text-xs text-muted">Reviewed by {f.reviewedBy.name}</p>}
                </li>
              ))}
            </ul>
          )}
          <div className="p-4 pt-0">
            <Pagination page={page} pageCount={pageCount} basePath="/dashboard/administration/feedback" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
