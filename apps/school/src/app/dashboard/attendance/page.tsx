import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms } from "@/lib/services/academics";
import { getRosterForDate } from "@/lib/services/attendance";
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
  const classArms = await listClassArms(user.schoolId);

  const classArmId = params.classArmId || classArms[0]?.id;
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

          {!roster || roster.students.length === 0 ? (
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
