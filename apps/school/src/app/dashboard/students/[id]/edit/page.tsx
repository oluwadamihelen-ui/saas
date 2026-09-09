import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudent } from "@/lib/services/students";
import { listClassArms } from "@/lib/services/academics";
import { StudentForm } from "../../student-form";
import { updateStudentAction } from "../../actions";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSchoolUser();
  const [student, classArms] = await Promise.all([getStudent(user.schoolId, id), listClassArms(user.schoolId)]);

  if (!student) notFound();

  const action = updateStudentAction.bind(null, student.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Edit {student.firstName} {student.lastName}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Student details</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentForm
            action={action}
            classArms={classArms}
            submitLabel="Save changes"
            currentPhotoUrl={student.photoUrl}
            defaults={{
              firstName: student.firstName,
              lastName: student.lastName,
              otherNames: student.otherNames,
              dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString().slice(0, 10) : "",
              gender: student.gender,
              bloodGroup: student.bloodGroup,
              addressLine: student.addressLine,
              city: student.city,
              state: student.state,
              medicalNotes: student.medicalNotes,
              allergies: student.allergies,
              emergencyContact: student.emergencyContact,
              classArmId: student.classArmId,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
