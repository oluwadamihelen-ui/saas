import Link from "next/link";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StudentImportForm } from "./import-form";

const TEMPLATE_HEADER =
  "admissionNumber,firstName,lastName,otherNames,gender,dateOfBirth,className,address,city,state,bloodGroup,emergencyContact,allergies,medicalNotes,guardianFirstName,guardianLastName,guardianPhone,guardianEmail,guardianRelationship";
const TEMPLATE_EXAMPLE =
  '2023-0014,Amaka,Okafor,,FEMALE,2015-03-12,"Primary 4 A","12 Ikorodu Road",Lagos,Lagos,O+,08012345678,None,,Chidi,Okafor,08087654321,chidi.okafor@example.com,FATHER';

export default async function ImportStudentsPage() {
  await requirePermission(PERMISSIONS.STUDENTS_CREATE);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Import students</h1>
        <p className="text-sm text-muted">
          Bring your existing student roster in from a spreadsheet, rather than enrolling one at a time.{" "}
          <Link href="/dashboard/students/new" className="text-accent hover:underline">Enroll a single student</Link> instead if you
          only have a few.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV format</CardTitle>
          <CardDescription>
            One header row, then one student per row. Only firstName and lastName are required — everything else can be left blank.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted-surface p-3 text-xs text-foreground">
            {TEMPLATE_HEADER}
            {"\n"}
            {TEMPLATE_EXAMPLE}
          </pre>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
            <li>Leave admissionNumber blank to have one generated automatically — set it to preserve numbers from a previous system.</li>
            <li>className must match an existing class exactly (e.g. &quot;Primary 1 A&quot;), from Academics → Class arms — leave blank to enroll unassigned.</li>
            <li>gender is MALE, FEMALE, or blank. dateOfBirth uses YYYY-MM-DD.</li>
            <li>A guardian is only created for a row if guardianFirstName, guardianLastName and guardianPhone are all filled in.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
