import Link from "next/link";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GuardianImportForm } from "./import-guardians-form";
import { GUARDIAN_IMPORT_TEMPLATE_HEADER as TEMPLATE_HEADER, GUARDIAN_IMPORT_TEMPLATE_EXAMPLE as TEMPLATE_EXAMPLE } from "@/lib/services/import-templates";

export default async function ImportGuardiansPage() {
  await requirePermission(PERMISSIONS.GUARDIANS_MANAGE);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add guardians for existing students</h1>
        <p className="text-sm text-muted">
          For students who were already enrolled or bulk-imported without any parent/guardian on file — matches each row to a
          student by admission number and adds a new guardian to them. A student with no guardian has nobody who can be invited to
          the parent portal, or given a &ldquo;view as&rdquo; link to their child&rsquo;s portal.{" "}
          <Link href="/dashboard/students/import" className="text-accent hover:underline">Importing brand-new students?</Link> Use
          the regular student import instead — it already has guardian columns built in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV format</CardTitle>
          <CardDescription>
            One header row, then one guardian per row. A student with two parents needs two rows with the same admission number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted-surface p-3 text-xs text-foreground">
            {TEMPLATE_HEADER}
            {"\n"}
            {TEMPLATE_EXAMPLE}
          </pre>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
            <li>admissionNumber must match an existing student in your school exactly.</li>
            <li>guardianFirstName, guardianLastName and guardianPhone are required; guardianEmail is optional.</li>
            <li>guardianRelationship is FATHER, MOTHER, GUARDIAN, or OTHER — leave blank to default to GUARDIAN.</li>
          </ul>
          <a href="/api/data/templates/guardians" className="mt-3 inline-block text-xs text-accent hover:underline">
            Download this as a CSV template &rarr;
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <GuardianImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
