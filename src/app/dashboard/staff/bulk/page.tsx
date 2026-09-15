import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listAssignableRoles } from "@/lib/services/staff";
import { BulkStaffForm } from "./bulk-form";

export default async function BulkStaffPage() {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);
  const roles = await listAssignableRoles(user.schoolId);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Multiple users registration</h1>
        <p className="text-sm text-muted">
          Create or invite multiple staff accounts at once. Enter rows manually, or upload a CSV —{" "}
          <Link href="/api/data/templates/staff" className="text-accent hover:underline">download the template</Link> to see
          the expected columns.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add staff in bulk</CardTitle>
          <CardDescription>Every row is validated before anything is created — you&apos;ll see exactly what&apos;s wrong before confirming.</CardDescription>
        </CardHeader>
        <CardContent>
          <BulkStaffForm roles={roles} />
        </CardContent>
      </Card>
    </div>
  );
}
