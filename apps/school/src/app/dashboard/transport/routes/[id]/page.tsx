import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getRoute } from "@/lib/services/transport";
import { listActiveStudentsBrief } from "@/lib/services/students";
import { AddStopForm, AssignStudentForm } from "../../forms";
import { UnassignButton } from "../../unassign-button";

export default async function TransportRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.TRANSPORT_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.TRANSPORT_MANAGE);
  const { id } = await params;

  const [route, students] = await Promise.all([
    getRoute(user.schoolId, id),
    canManage ? listActiveStudentsBrief(user.schoolId) : Promise.resolve([]),
  ]);
  if (!route) notFound();

  const assignedStudentIds = new Set(route.assignments.map((a) => a.studentId));
  const unassignedStudents = students.filter((s) => !assignedStudentIds.has(s.id));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard/transport">&larr; Transport</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{route.name}</h1>
        <p className="text-sm text-muted">{route.vehicle ? `${route.vehicle.name} · ${route.vehicle.plateNumber}` : "No vehicle assigned"}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Stops</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canManage && <AddStopForm routeId={route.id} nextOrder={route.stops.length} />}
          {route.stops.length === 0 ? (
            <EmptyState title="No stops added yet" className="p-4" />
          ) : (
            <ol className="space-y-2">
              {route.stops.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <span className="font-medium text-foreground">{s.order + 1}. {s.name}</span>
                  <span className="text-xs text-muted">
                    {s.pickupTime ? `Pickup ${s.pickupTime}` : ""}{s.pickupTime && s.dropoffTime ? " · " : ""}{s.dropoffTime ? `Drop-off ${s.dropoffTime}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Assign a student</CardTitle></CardHeader>
          <CardContent>
            <AssignStudentForm routeId={route.id} stops={route.stops} students={unassignedStudents} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Assigned students</CardTitle></CardHeader>
        <CardContent className="p-0">
          {route.assignments.length === 0 ? (
            <EmptyState title="No students assigned to this route yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {route.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{a.student.firstName} {a.student.lastName}</p>
                    <p className="text-xs text-muted">{a.stop ? a.stop.name : "No specific stop"}</p>
                  </div>
                  {canManage && <UnassignButton assignmentId={a.id} routeId={route.id} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
