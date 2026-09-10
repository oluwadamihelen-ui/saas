import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getTeacherActivityReport } from "@/lib/services/lectures";

export default async function TeacherActivityPage() {
  const user = await requirePermission(PERMISSIONS.ONLINE_LEARNING_VIEW_ALL);
  const rows = await getTeacherActivityReport(user.schoolId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Teacher Activity</h1>
        <p className="text-sm text-muted">Lecture and live class activity by teacher.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No teacher activity yet." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Total lectures</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Total live classes</TableHead>
              <TableHead>Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.teacherId}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                <TableCell className="text-muted">{row.totalLectures}</TableCell>
                <TableCell className="text-muted">{row.publishedLectures}</TableCell>
                <TableCell className="text-muted">{row.totalLiveClasses}</TableCell>
                <TableCell className="text-muted">{row.completedLiveClasses}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
