import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms } from "@/lib/services/academics";
import { getRosterForDate } from "@/lib/services/attendance";
import { getAccessibleClassArmIds, canAccessClassArm } from "@/lib/services/performance/authorization";
import { RosterForm } from "./roster-form";
import { RosterReadOnly } from "./roster-readonly";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classArmId?: string; date?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_VIEW);
  const perms = await getUserPermissions(user.id);
  const canMark = perms.has(PERMISSIONS.ATTENDANCE_MARK);
  const params = await searchParams;
  const allClassArms = await listClassArms(user.schoolId);

  // A teacher (no ACADEMICS_MANAGE) only sees classes they're actually
  // assigned to via TeacherAssignment — same access decision Performance
  // Analysis already uses, reused here for attendance for the same reason:
  // a class picker showing every class in the school would let a teacher
  // load and mark attendance for a class that isn't theirs. Admin-tier
  // roles (ACADEMICS_MANAGE) still see and can mark every class.
  const access = await getAccessibleClassArmIds(user.schoolId, user.id, perms);
  const classArms = access === "ALL" ? allClassArms : allClassArms.filter((arm) => canAccessClassArm(access, arm.id));

  const requestedClassArmId = params.classArmId;
  const classArmId =
    requestedClassArmId && canAccessClassArm(access, requestedClassArmId) ? requestedClassArmId : classArms[0]?.id;
  const date = params.date || today();

  const roster = classArmId ? await getRosterForDate(user.schoolId, classArmId, date) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Attendance</h1>
        <p className="text-sm text-muted">{canMark ? "Mark daily attendance for a class." : "View daily attendance for a class."}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 sm:space-y-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="w-64 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Class</label>
              <Select id="classArmId" name="classArmId" defaultValue={classArmId ?? ""}>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>
                ))}
              </Select>
            </div>
            <div className="w-48 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="date">Date</label>
              <Input id="date" name="date" type="date" defaultValue={date} max={today()} />
            </div>
            <Button type="submit" variant="secondary">Load roster</Button>
          </form>

          {classArms.length === 0 ? (
            <EmptyState
              title="No classes assigned to you"
              description="You aren't assigned to teach any class yet — ask your school administrator to assign you to one."
            />
          ) : !roster || roster.students.length === 0 ? (
            <EmptyState
              title="No active students in this class"
              description="Enroll students into this class arm before marking attendance."
            />
          ) : canMark ? (
            <RosterForm classArmId={classArmId!} date={date} roster={roster.students} />
          ) : (
            <RosterReadOnly roster={roster.students} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
