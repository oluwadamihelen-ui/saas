import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getAdmissionFee } from "@/lib/services/admission";
import { getSchool } from "@/lib/services/school";
import { AdmissionFeeForm } from "./fee-form";

export default async function AdmissionFeePage() {
  const user = await requirePermission(PERMISSIONS.ADMISSION_MANAGE);
  const [{ admissionFeeMinor, currency }, school] = await Promise.all([
    getAdmissionFee(user.schoolId),
    getSchool(user.schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set Admission Fee</h1>
        <p className="text-sm text-muted">Configure the fee applicants pay when they apply online.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admission fee</CardTitle>
          <CardDescription>This amount is shown to applicants on your public application form.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdmissionFeeForm currentAmount={admissionFeeMinor} currency={currency} />
        </CardContent>
      </Card>

      {school && (
        <Card>
          <CardHeader>
            <CardTitle>Public application form</CardTitle>
            <CardDescription>Share this link with prospective parents.</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-all rounded-md bg-muted-surface px-3 py-2 text-sm text-foreground">/apply/{school.slug}</code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
