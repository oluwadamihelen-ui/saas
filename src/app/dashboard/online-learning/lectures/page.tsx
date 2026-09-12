import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listLecturesForTeacher } from "@/lib/services/lectures";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "warning" } as const;

export default async function MyLecturesPage() {
  const user = await requirePermission(PERMISSIONS.LECTURES_VIEW);
  const lectures = await listLecturesForTeacher(user.schoolId, user.id);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Lectures</h1>
          <p className="text-sm text-muted">Self-paced lectures you have created.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/online-learning/lectures/new">Create Lecture</Link>
        </Button>
      </div>

      {lectures.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No lectures yet" description="Create your first lecture to share learning material with your students." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Subject / Class</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lectures.map((lecture) => (
              <TableRow key={lecture.id}>
                <TableCell className="font-medium text-foreground">{lecture.title}</TableCell>
                <TableCell className="text-muted">
                  {lecture.subject.name} · {lecture.classArm.classGroup.name} {lecture.classArm.name}
                </TableCell>
                <TableCell className="text-muted">{lecture._count.resources} item(s)</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[lecture.status]}>{lecture.status}</Badge>
                </TableCell>
                <TableCell className="text-muted">{formatDate(lecture.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/online-learning/lectures/${lecture.id}`} className="text-sm font-medium text-accent hover:underline">
                      View
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
