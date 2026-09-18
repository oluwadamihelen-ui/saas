import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listHostels } from "@/lib/services/hostel";
import { AddHostelForm } from "./forms";

export default async function HostelPage() {
  const user = await requirePermission(PERMISSIONS.HOSTEL_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.HOSTEL_MANAGE);

  const hostels = await listHostels(user.schoolId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hostel</h1>
        <p className="text-sm text-muted">{hostels.length} hostel{hostels.length === 1 ? "" : "s"}</p>
      </div>

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Add a hostel</CardTitle></CardHeader>
          <CardContent><AddHostelForm /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Hostels</CardTitle></CardHeader>
        <CardContent className="p-0">
          {hostels.length === 0 ? (
            <EmptyState title="No hostels yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {hostels.map((h) => {
                const capacity = h.rooms.reduce((sum, r) => sum + r.capacity, 0);
                const occupied = h.rooms.reduce((sum, r) => sum + r._count.assignments, 0);
                return (
                  <li key={h.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <Link href={`/dashboard/hostel/${h.id}`} className="flex-1">
                      <p className="font-medium text-foreground hover:text-accent">{h.name}</p>
                      <p className="text-xs text-muted">
                        {h.type === "MALE" ? "Male" : h.type === "FEMALE" ? "Female" : "Mixed"} · {h.rooms.length} room{h.rooms.length === 1 ? "" : "s"}
                        {h.wardenName ? ` · Warden: ${h.wardenName}` : ""}
                      </p>
                    </Link>
                    <Badge variant={occupied >= capacity && capacity > 0 ? "danger" : "success"}>{occupied}/{capacity} beds</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
