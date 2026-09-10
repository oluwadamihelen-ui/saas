import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSchoolBySlug, getApplicantPublic } from "@/lib/services/admission";
import { formatMoney } from "@/lib/money";
import { NotifyTransferButton } from "./notify-transfer-button";
import { PayApplicationFeeOnlineButton } from "./pay-online-button";

const FEE_STATUS_VARIANT = { UNPAID: "warning", PENDING_CONFIRMATION: "accent", PAID: "success" } as const;

export default async function ApplicationConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; applicantId: string }>;
}) {
  const { slug, applicantId } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  const applicant = await getApplicantPublic(school.id, applicantId);
  if (!applicant) notFound();

  const hasBankDetails = school.bankName && school.bankAccountNumber;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Application received</h1>
        <p className="text-sm text-muted">
          Thank you — we&apos;ve received {applicant.childFirstName} {applicant.childLastName}&apos;s application to {school.name}.
        </p>
      </div>

      {applicant.admissionFeeMinor ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Admission fee</CardTitle>
              <Badge variant={FEE_STATUS_VARIANT[applicant.feeStatus]}>{applicant.feeStatus.replace("_", " ")}</Badge>
            </div>
            <CardDescription>{formatMoney(applicant.admissionFeeMinor, school.currency)}</CardDescription>
          </CardHeader>
          {applicant.feeStatus === "UNPAID" && (
            <CardContent className="space-y-3">
              <PayApplicationFeeOnlineButton slug={slug} applicantId={applicant.id} />
              {hasBankDetails && (
                <div className="space-y-3 rounded-md border border-dashed border-border p-4">
                  <p className="text-sm font-medium text-foreground">Or pay by bank transfer</p>
                  <div className="text-sm text-muted">
                    <p>Bank: {school.bankName}</p>
                    <p>Account name: {school.bankAccountName}</p>
                    <p>Account number: {school.bankAccountNumber}</p>
                  </div>
                  <NotifyTransferButton slug={slug} applicantId={applicant.id} />
                  <p className="text-xs text-muted">The school will confirm your payment once it&apos;s received.</p>
                </div>
              )}
            </CardContent>
          )}
          {applicant.feeStatus === "PENDING_CONFIRMATION" && (
            <CardContent>
              <p className="text-sm text-muted">We&apos;ve noted your transfer — the school will confirm receipt shortly.</p>
            </CardContent>
          )}
          {applicant.feeStatus === "PAID" && (
            <CardContent>
              <p className="text-sm font-medium text-success">Fee received. Thank you!</p>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-muted">No admission fee is required. The school will be in touch about next steps.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
