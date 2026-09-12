import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import { listEnterpriseInquiries } from "@/lib/services/enterprise-inquiries";
import { formatDateTime } from "@/lib/utils";
import { InquiryActions } from "./inquiry-actions";

const STATUS_VARIANT = { NEW: "warning", CONTACTED: "accent", CONVERTED: "success", DECLINED: "neutral" } as const;

export default async function PlatformInquiriesPage() {
  await requireSuperAdmin();
  const inquiries = await listEnterpriseInquiries();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Enterprise inquiries</h1>
        <p className="text-sm text-muted">Submitted from the public pricing page — never auto-creates a subscription.</p>
      </div>

      {inquiries.length === 0 ? (
        <Card><CardContent className="p-8"><EmptyState title="No inquiries yet" /></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <Card key={inquiry.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {inquiry.schoolOrGroupName}
                  <Badge variant={STATUS_VARIANT[inquiry.status]}>{inquiry.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-1 sm:grid-cols-2">
                  <p><span className="text-muted">Contact:</span> {inquiry.contactName}</p>
                  <p><span className="text-muted">Email:</span> {inquiry.email}</p>
                  <p><span className="text-muted">Phone:</span> {inquiry.phone}</p>
                  <p><span className="text-muted">Submitted:</span> {formatDateTime(inquiry.createdAt)}</p>
                  {inquiry.studentCount != null && <p><span className="text-muted">Students:</span> {inquiry.studentCount}</p>}
                  {inquiry.campusCount != null && <p><span className="text-muted">Campuses:</span> {inquiry.campusCount}</p>}
                </div>
                {inquiry.currentSoftware && <p><span className="text-muted">Current software:</span> {inquiry.currentSoftware}</p>}
                {inquiry.message && <p className="text-foreground">{inquiry.message}</p>}
                {inquiry.reviewedBy && (
                  <p className="text-xs text-muted">
                    Reviewed by {inquiry.reviewedBy.name} on {inquiry.reviewedAt ? formatDateTime(inquiry.reviewedAt) : ""}
                  </p>
                )}
                {inquiry.status === "NEW" && <InquiryActions inquiryId={inquiry.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
