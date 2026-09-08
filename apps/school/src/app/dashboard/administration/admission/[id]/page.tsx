import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getApplicant } from "@/lib/services/admission";
import { listClassArms } from "@/lib/services/academics";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { getSchool } from "@/lib/services/school";
import { StatusForm } from "./status-form";
import { ConfirmFeeButton } from "./confirm-fee-button";
import { AdmitForm } from "./admit-form";

const STATUS_VARIANT = {
  APPLIED: "neutral",
  UNDER_REVIEW: "warning",
  OFFERED: "accent",
  ACCEPTED: "success",
  REJECTED: "danger",
  ENROLLED: "success",
} as const;

export default async function ApplicantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.ADMISSION_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.ADMISSION_MANAGE);
  const { id } = await params;

  const [applicant, school] = await Promise.all([getApplicant(user.schoolId, id), getSchool(user.schoolId)]);
  if (!applicant) notFound();

  const classArms = canManage && applicant.status === "ACCEPTED" ? await listClassArms(user.schoolId) : [];
  const currency = school?.currency ?? "NGN";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/administration/admission" className="text-sm text-muted hover:text-accent">&larr; Applicants</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{applicant.childFirstName} {applicant.childLastName}</h1>
          <Badge variant={STATUS_VARIANT[applicant.status]}>{applicant.status.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Applicant details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted">Date of birth:</span> {applicant.dateOfBirth ? formatDate(applicant.dateOfBirth) : "—"}</p>
            <p><span className="text-muted">Gender:</span> {applicant.gender ?? "—"}</p>
            <p><span className="text-muted">Desired class:</span> {applicant.desiredClassGroup?.name ?? "—"}</p>
            <p><span className="text-muted">Address:</span> {applicant.addressLine ?? "—"}</p>
            <p><span className="text-muted">Applied:</span> {formatDate(applicant.createdAt)}</p>
            {applicant.notes && <p><span className="text-muted">Notes:</span> {applicant.notes}</p>}
            {applicant.reviewedBy && <p><span className="text-muted">Last reviewed by:</span> {applicant.reviewedBy.name}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Parent / guardian</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted">Name:</span> {applicant.parentName}</p>
            <p><span className="text-muted">Email:</span> {applicant.parentEmail}</p>
            <p><span className="text-muted">Phone:</span> {applicant.parentPhone}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application fee</CardTitle>
          <CardDescription>
            {applicant.admissionFeeMinor ? formatMoney(applicant.admissionFeeMinor, currency) : "No fee required"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground">Status: {applicant.feeStatus.replace("_", " ")}</p>
          {canManage && applicant.feeStatus === "PENDING_CONFIRMATION" && <ConfirmFeeButton applicantId={applicant.id} />}
        </CardContent>
      </Card>

      {canManage && !applicant.enrolledStudentId && (
        <Card>
          <CardHeader><CardTitle>Update application</CardTitle></CardHeader>
          <CardContent>
            <StatusForm applicantId={applicant.id} status={applicant.status} />
          </CardContent>
        </Card>
      )}

      {canManage && applicant.status === "ACCEPTED" && !applicant.enrolledStudentId && (
        <Card>
          <CardHeader>
            <CardTitle>Full Admission Process</CardTitle>
            <CardDescription>Creates the student record and admission number, and links the parent as guardian.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdmitForm applicantId={applicant.id} classArms={classArms} />
          </CardContent>
        </Card>
      )}

      {applicant.enrolledStudent && (
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-success">
              Admitted as a student — admission no. {applicant.enrolledStudent.admissionNumber}.{" "}
              <Link href={`/dashboard/students/${applicant.enrolledStudent.id}`} className="text-accent hover:underline">View student</Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
