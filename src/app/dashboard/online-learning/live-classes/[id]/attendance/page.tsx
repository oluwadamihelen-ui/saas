import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getLiveClassForTeacher, getLiveClassAttendanceForTeacher } from "@/lib/services/live-classes";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { ATTENDED: "success", JOINED: "warning", LEFT_EARLY: "warning", ABSENT: "neutral" } as const;
const STATUS_LABEL = { ATTENDED: "Attended", JOINED: "Joined", LEFT_EARLY: "Left early", ABSENT: "Absent" } as const;

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export default async function LiveClassAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_VIEW);
  const liveClass = await getLiveClassForTeacher(user.schoolId, user.id, id);
  if (!liveClass) notFound();
  const rows = await getLiveClassAttendanceForTeacher(user.schoolId, user.id, id);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Attendance — {liveClass.title}</h1>
        <p className="text-sm text-muted">
          {liveClass.subject.name} · {liveClass.classArm.classGroup.name} {liveClass.classArm.name} · {formatDate(liveClass.scheduledStart)}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No students are enrolled in this class.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Admission No</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Left</TableHead>
              <TableHead>Time present</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.student.firstName} {row.student.lastName}</TableCell>
                <TableCell className="text-muted">{row.student.admissionNumber}</TableCell>
                <TableCell className="text-muted">{row.firstJoinedAt ? formatDate(row.firstJoinedAt) : "—"}</TableCell>
                <TableCell className="text-muted">{row.lastLeftAt ? formatDate(row.lastLeftAt) : "—"}</TableCell>
                <TableCell className="text-muted">{formatDuration(row.totalConnectedSeconds)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Link href={`/dashboard/online-learning/live-classes/${liveClass.id}`} className="text-sm text-accent">
        ← Back to class
      </Link>
    </div>
  );
}
