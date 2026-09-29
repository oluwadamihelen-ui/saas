import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { requirePermission, getUserPermissions } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { listMaintenanceRequests } from "@/lib/services/maintenance";
import { listRooms } from "@/lib/services/rooms";
import { NewRequestForm } from "./new-request-form";
import { RequestActions } from "./request-actions";

export const metadata: Metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  const user = await requirePermission(PERMISSIONS.MAINTENANCE_VIEW);
  const perms = await getUserPermissions(user.id, user.hotelId);
  const canManage = perms.has(PERMISSIONS.MAINTENANCE_MANAGE);

  const [requests, rooms] = await Promise.all([listMaintenanceRequests(user.hotelId), listRooms(user.hotelId)]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Report an issue</CardTitle>
          </CardHeader>
          <CardContent>
            <NewRequestForm rooms={rooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber }))} />
          </CardContent>
        </Card>
      )}

      {requests.length === 0 ? (
        <EmptyState icon={<Wrench className="h-6 w-6" />} title="No maintenance requests" description="Report issues above to track them through to resolution." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Room</th>
                  <th className="px-5 py-3">Issue</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Reported</th>
                  <th className="px-5 py-3">Assigned</th>
                  {canManage && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{r.room?.roomNumber ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">
                      {r.issueType.replaceAll("_", " ")}
                      <p className="text-xs">{r.description}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.priority} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(r.createdAt)}</td>
                    <td className="px-5 py-3 text-muted">{r.assignedTo?.name ?? "Unassigned"}</td>
                    {canManage && (
                      <td className="px-5 py-3">
                        <RequestActions id={r.id} status={r.status} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
