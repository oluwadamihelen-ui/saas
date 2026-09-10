import type { Metadata } from "next";
import { SprayCan } from "lucide-react";
import { requirePermission, getUserPermissions } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { listHousekeepingTasks } from "@/lib/services/housekeeping";
import { listRooms } from "@/lib/services/rooms";
import { prisma } from "@/lib/db";
import { NewTaskForm } from "./new-task-form";
import { TaskActions } from "./task-actions";
import type { HousekeepingTaskStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Housekeeping" };

const COLUMNS: { status: HousekeepingTaskStatus; label: string }[] = [
  { status: "PENDING", label: "Pending" },
  { status: "IN_PROGRESS", label: "Cleaning" },
  { status: "COMPLETED", label: "Awaiting Inspection" },
  { status: "INSPECTED", label: "Inspected" },
];

export default async function HousekeepingPage() {
  const user = await requirePermission(PERMISSIONS.HOUSEKEEPING_VIEW);
  const perms = await getUserPermissions(user.id, user.hotelId);
  const canManage = perms.has(PERMISSIONS.HOUSEKEEPING_MANAGE);

  const [tasks, rooms, staff] = await Promise.all([
    listHousekeepingTasks(user.hotelId),
    listRooms(user.hotelId),
    prisma.hotelMember.findMany({ where: { hotelId: user.hotelId, employmentStatus: "ACTIVE", role: { in: ["HOUSEKEEPING", "HOTEL_MANAGER"] } }, include: { user: true } }),
  ]);

  const staffOptions = staff.map((s) => ({ id: s.userId, name: s.user.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Housekeeping</h1>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>New task</CardTitle>
          </CardHeader>
          <CardContent>
            <NewTaskForm rooms={rooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber }))} staff={staffOptions} />
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 ? (
        <EmptyState icon={<SprayCan className="h-6 w-6" />} title="No housekeeping tasks" description="Tasks are created automatically after checkout, or manually above." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="space-y-3">
                <h3 className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                  {col.label}
                  <span className="rounded-full bg-muted-surface px-2 py-0.5 text-foreground">{colTasks.length}</span>
                </h3>
                <div className="space-y-2">
                  {colTasks.map((t) => (
                    <Card key={t.id}>
                      <CardContent className="space-y-2 p-3">
                        <p className="text-sm font-medium text-foreground">Room {t.room.roomNumber}</p>
                        <p className="text-xs text-muted">{t.taskType.replaceAll("_", " ")}</p>
                        <p className="text-xs text-muted">{t.assignedTo?.name ?? "Unassigned"}</p>
                        <p className="text-[11px] text-muted">{formatDate(t.createdAt)}</p>
                        {canManage && <TaskActions taskId={t.id} status={t.status} />}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
