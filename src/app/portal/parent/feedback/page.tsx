import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requireSchoolUser } from "@/lib/auth/require";
import { listMyFeedback } from "@/lib/services/feedback";
import { formatDate } from "@/lib/utils";
import { SubmitFeedbackForm } from "@/app/dashboard/administration/feedback/submit-form";

export default async function ParentFeedbackPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireSchoolUser();
  const params = await searchParams;
  const { items, total, page, pageCount } = await listMyFeedback(user.schoolId, user.id, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feedback</h1>
        <p className="text-sm text-muted">Share a suggestion or concern with the school.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Send feedback</CardTitle></CardHeader>
        <CardContent><SubmitFeedbackForm /></CardContent>
      </Card>

      {total > 0 && (
        <Card>
          <CardHeader><CardTitle>Your past submissions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {items.length === 0 ? (
              <EmptyState title="Nothing here yet" />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((f) => (
                  <li key={f.id} className="space-y-1 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted">{formatDate(f.createdAt)}</p>
                      <Badge variant={f.status === "REVIEWED" ? "success" : "warning"}>{f.status}</Badge>
                    </div>
                    <p className="text-foreground">{f.message}</p>
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={page} pageCount={pageCount} basePath="/portal/parent/feedback" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
