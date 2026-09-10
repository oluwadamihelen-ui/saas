import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { getStudentAttendanceHistory } from "@/lib/services/attendance";
import { formatDate } from "@/lib/utils";

const ATTENDANCE_BADGE = { PRESENT: "success", LATE: "warning", EXCUSED: "neutral", ABSENT: "danger" } as const;

export default async function StudentAttendancePage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const attendance = await getStudentAttendanceHistory(user.schoolId, student.id);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Attendance</h1>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted">Attendance rate</p>
              <p className="text-2xl font-semibold text-foreground">
                {attendance.attendanceRate === null ? "—" : `${attendance.attendanceRate}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Days recorded</p>
              <p className="text-2xl font-semibold text-foreground">{attendance.total}</p>
            </div>
          </div>
          {attendance.records.length === 0 ? (
            <EmptyState title="No attendance recorded yet" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {attendance.records.map((r) => (
                <li key={r.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="text-foreground">{formatDate(r.date)}</span>
                  <Badge variant={ATTENDANCE_BADGE[r.status]}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
