import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getLectureProgressForTeacher } from "@/lib/services/lectures";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { NOT_STARTED: "neutral", IN_PROGRESS: "warning", COMPLETED: "success" } as const;
const STATUS_LABEL = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed" } as const;

export default async function LectureProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.LECTURES_VIEW);

  let data;
  try {
    data = await getLectureProgressForTeacher(user.schoolId, user.id, id);
  } catch {
    notFound();
  }
  const { lecture, rows, summary } = data;

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lecture.title}</h1>
        <p className="text-sm text-muted">
          Class: {rows.length} student(s) · Completion rate {summary.completionRate}%
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Students" value={summary.total} />
          <Stat label="Not started" value={summary.notStarted} />
          <Stat label="In progress" value={summary.inProgress} />
          <Stat label="Completed" value={summary.completed} />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No students have completed this lecture yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Admission No</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>First opened</TableHead>
              <TableHead>Last accessed</TableHead>
              <TableHead>Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.studentId}>
                <TableCell className="font-medium text-foreground">{row.firstName} {row.lastName}</TableCell>
                <TableCell className="text-muted">{row.admissionNumber}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </TableCell>
                <TableCell className="text-muted">{row.progressPercent}%</TableCell>
                <TableCell className="text-muted">{row.firstOpenedAt ? formatDate(row.firstOpenedAt) : "—"}</TableCell>
                <TableCell className="text-muted">{row.lastAccessedAt ? formatDate(row.lastAccessedAt) : "—"}</TableCell>
                <TableCell className="text-muted">{row.completedAt ? formatDate(row.completedAt) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Link href={`/dashboard/online-learning/lectures/${lecture.id}`} className="text-sm text-accent">
        ← Back to lecture
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
