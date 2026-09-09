import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listAllLecturesForSchool } from "@/lib/services/lectures";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "warning" } as const;

export default async function AdminLecturesPage() {
  const user = await requirePermission(PERMISSIONS.ONLINE_LEARNING_VIEW_ALL);
  const lectures = await listAllLecturesForSchool(user.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Lectures</h1>
        <p className="text-sm text-muted">Every lecture created across the school.</p>
      </div>

      {lectures.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No lectures have been created yet." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Subject / Class</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lectures.map((lecture) => (
              <TableRow key={lecture.id}>
                <TableCell className="font-medium text-foreground">{lecture.title}</TableCell>
                <TableCell className="text-muted">{lecture.teacher.name}</TableCell>
                <TableCell className="text-muted">
                  {lecture.subject.name} · {lecture.classArm.classGroup.name} {lecture.classArm.name}
                </TableCell>
                <TableCell className="text-muted">{lecture._count.resources} item(s)</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[lecture.status]}>{lecture.status}</Badge>
                </TableCell>
                <TableCell className="text-muted">{formatDate(lecture.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
