import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireSchoolUser } from "@/lib/auth/require";
import { listClassArms } from "@/lib/services/academics";
import { StudentForm } from "../student-form";
import { createStudentAction } from "../actions";

export default async function NewStudentPage() {
  const user = await requireSchoolUser();
  const classArms = await listClassArms(user.schoolId);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Enroll a student</h1>
        <p className="text-sm text-muted">An admission number is generated automatically.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Student details</CardTitle>
          <CardDescription>You can add more guardians and documents after enrolling.</CardDescription>
        </CardHeader>
        <CardContent>
          <StudentForm action={createStudentAction} classArms={classArms} submitLabel="Enroll student" showGuardianFields />
        </CardContent>
      </Card>
    </div>
  );
}
