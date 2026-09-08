import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getHostel } from "@/lib/services/hostel";
import { listActiveStudentsBrief } from "@/lib/services/students";
import { AddRoomForm, AssignStudentForm } from "../forms";
import { UnassignButton } from "../unassign-button";

export default async function HostelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.HOSTEL_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.HOSTEL_MANAGE);
  const { id } = await params;

  const [hostel, students] = await Promise.all([
    getHostel(user.schoolId, id),
    canManage ? listActiveStudentsBrief(user.schoolId) : Promise.resolve([]),
  ]);
  if (!hostel) notFound();

  const rooms = hostel.rooms.map((r) => ({ ...r, availableBeds: r.capacity - r.assignments.length }));
  const assignedStudentIds = new Set(rooms.flatMap((r) => r.assignments.map((a) => a.studentId)));
  const unassignedStudents = students.filter((s) => !assignedStudentIds.has(s.id));

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard/hostel">&larr; Hostel</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{hostel.name}</h1>
        <p className="text-sm text-muted">
          {hostel.type === "MALE" ? "Male" : hostel.type === "FEMALE" ? "Female" : "Mixed"}
          {hostel.wardenName ? ` · Warden: ${hostel.wardenName}${hostel.wardenPhone ? ` (${hostel.wardenPhone})` : ""}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Rooms</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canManage && <AddRoomForm hostelId={hostel.id} />}
          {rooms.length === 0 ? (
            <EmptyState title="No rooms added yet" className="p-4" />
          ) : (
            <ul className="space-y-2">
              {rooms.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">Room {r.roomNumber}</span>
                    <Badge variant={r.availableBeds > 0 ? "success" : "danger"}>{r.assignments.length}/{r.capacity} beds</Badge>
                  </div>
                  {r.assignments.length > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      {r.assignments.map((a) => `${a.student.firstName} ${a.student.lastName}`).join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Assign a student</CardTitle></CardHeader>
          <CardContent>
            <AssignStudentForm hostelId={hostel.id} rooms={rooms} students={unassignedStudents} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Assigned students</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rooms.every((r) => r.assignments.length === 0) ? (
            <EmptyState title="No students assigned yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {rooms.flatMap((r) =>
                r.assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{a.student.firstName} {a.student.lastName}</p>
                      <p className="text-xs text-muted">Room {r.roomNumber}</p>
                    </div>
                    {canManage && <UnassignButton assignmentId={a.id} hostelId={hostel.id} />}
                  </li>
                ))
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
