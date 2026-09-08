import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { listSlotsForClassArm } from "@/lib/services/timetable";

export default async function StudentTimetablePage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const slots = student.classArmId ? await listSlotsForClassArm(user.schoolId, student.classArmId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Timetable</h1>
        <p className="text-sm text-muted">
          {student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "Unassigned"}
        </p>
      </div>

      {slots.length === 0 ? (
        <EmptyState title="No timetable published yet" />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {slots.map((slot) => (
            <li key={slot.id} className="flex items-center justify-between p-3 text-sm">
              <span className="text-foreground">{slot.subject.name}</span>
              <span className="text-muted">{slot.dayOfWeek} · {slot.startTime}–{slot.endTime} · {slot.teacher.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
