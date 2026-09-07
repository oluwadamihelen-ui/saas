import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listTeacherAssignments, listTeachers } from "@/lib/services/teacher-assignments";
import { listClassArms, listSubjects } from "@/lib/services/academics";
import { TeacherAssignmentForm } from "./assignment-form";
import { DeleteAssignmentButton } from "./delete-assignment-button";

export default async function AcademicsPage() {
  const user = await requirePermission(PERMISSIONS.ACADEMICS_MANAGE);

  const [assignments, teachers, subjects, classArms] = await Promise.all([
    listTeacherAssignments(user.schoolId),
    listTeachers(user.schoolId),
    listSubjects(user.schoolId),
    listClassArms(user.schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Academics</h1>
        <p className="text-sm text-muted">Assign teachers to the subjects and classes they teach.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher assignments</CardTitle>
          <CardDescription>
            This determines what a teacher can mark attendance for, set assignments in, and enter scores for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <TeacherAssignmentForm teachers={teachers} subjects={subjects} classArms={classArms} />

          {assignments.length === 0 ? (
            <EmptyState title="No assignments yet" description="Assign a teacher above to get started." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.teacher.name}</TableCell>
                    <TableCell className="text-muted">{a.subject.name}</TableCell>
                    <TableCell className="text-muted">{a.classArm.classGroup.name} {a.classArm.name}</TableCell>
                    <TableCell className="text-right"><DeleteAssignmentButton id={a.id} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
