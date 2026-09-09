import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentEngagementReport } from "@/lib/services/lectures";

export default async function StudentEngagementPage() {
  const user = await requirePermission(PERMISSIONS.ONLINE_LEARNING_VIEW_ALL);
  const rows = await getStudentEngagementReport(user.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Student Engagement</h1>
        <p className="text-sm text-muted">How students are engaging with published lectures.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<GraduationCap className="h-6 w-6" />} title="No student engagement recorded yet." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Admission No</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Lectures engaged</TableHead>
              <TableHead>Lectures completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.studentId}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                <TableCell className="text-muted">{row.admissionNumber}</TableCell>
                <TableCell className="text-muted">{row.className}</TableCell>
                <TableCell className="text-muted">{row.lecturesEngaged}</TableCell>
                <TableCell className="text-muted">{row.lecturesCompleted}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
