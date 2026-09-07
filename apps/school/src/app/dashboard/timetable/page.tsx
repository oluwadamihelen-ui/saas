import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms, listSubjects } from "@/lib/services/academics";
import { listTeachers } from "@/lib/services/teacher-assignments";
import { listSlotsForClassArm, listSlotsForTeacher, DAYS_OF_WEEK } from "@/lib/services/timetable";
import { SlotForm } from "./slot-form";
import { DeleteSlotButton } from "./delete-slot-button";

function dayLabel(day: string) {
  return day[0] + day.slice(1).toLowerCase();
}

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ classArmId?: string; teacherId?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.TIMETABLE_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.TIMETABLE_MANAGE);

  const params = await searchParams;
  const [classArms, subjects, teachers] = await Promise.all([
    listClassArms(user.schoolId),
    listSubjects(user.schoolId),
    listTeachers(user.schoolId),
  ]);

  const classArmId = params.classArmId || classArms[0]?.id;
  const classSlots = classArmId ? await listSlotsForClassArm(user.schoolId, classArmId) : [];

  const teacherId = params.teacherId;
  const teacherSlots = teacherId ? await listSlotsForTeacher(user.schoolId, teacherId) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Timetable</h1>
        <p className="text-sm text-muted">Weekly class periods, by class or by teacher.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class timetable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="flex items-end gap-3" method="get">
            <div className="w-64 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Class</label>
              <Select id="classArmId" name="classArmId" defaultValue={classArmId ?? ""}>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">Load</Button>
          </form>

          {canManage && classArmId && <SlotForm classArmId={classArmId} subjects={subjects} teachers={teachers} />}

          {classSlots.length === 0 ? (
            <EmptyState title="No periods scheduled" description="Add a period above to build this class's timetable." />
          ) : (
            <div className="space-y-4">
              {DAYS_OF_WEEK.filter((day) => classSlots.some((s) => s.dayOfWeek === day)).map((day) => (
                <div key={day}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{dayLabel(day)}</p>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {classSlots.filter((s) => s.dayOfWeek === day).map((slot) => (
                      <li key={slot.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <span className="w-28 text-muted">{slot.startTime}–{slot.endTime}</span>
                        <span className="flex-1 font-medium text-foreground">{slot.subject.name}</span>
                        <span className="text-muted">{slot.teacher.name}</span>
                        {canManage && <DeleteSlotButton id={slot.id} />}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teacher timetable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="flex items-end gap-3" method="get">
            {classArmId && <input type="hidden" name="classArmId" value={classArmId} />}
            <div className="w-64 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="teacherId">Teacher</label>
              <Select id="teacherId" name="teacherId" defaultValue={teacherId ?? ""}>
                <option value="">Select a teacher</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <Button type="submit" variant="secondary">View</Button>
          </form>

          {teacherSlots && (
            teacherSlots.length === 0 ? (
              <EmptyState title="No periods scheduled for this teacher" />
            ) : (
              <div className="space-y-4">
                {DAYS_OF_WEEK.filter((day) => teacherSlots.some((s) => s.dayOfWeek === day)).map((day) => (
                  <div key={day}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{dayLabel(day)}</p>
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {teacherSlots.filter((s) => s.dayOfWeek === day).map((slot) => (
                        <li key={slot.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                          <span className="w-28 text-muted">{slot.startTime}–{slot.endTime}</span>
                          <span className="flex-1 font-medium text-foreground">{slot.subject.name}</span>
                          <Badge variant="accent">{slot.classArm.classGroup.name} {slot.classArm.name}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
