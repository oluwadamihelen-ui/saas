import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listVehicles, listRoutes } from "@/lib/services/transport";
import { AddVehicleForm, AddRouteForm } from "./forms";

export default async function TransportPage() {
  const user = await requirePermission(PERMISSIONS.TRANSPORT_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.TRANSPORT_MANAGE);

  const [vehicles, routes] = await Promise.all([listVehicles(user.schoolId), listRoutes(user.schoolId)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Transport</h1>
        <p className="text-sm text-muted">{routes.length} route{routes.length === 1 ? "" : "s"} · {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}</p>
      </div>

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Add a vehicle</CardTitle></CardHeader>
          <CardContent><AddVehicleForm /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Vehicles</CardTitle></CardHeader>
        <CardContent className="p-0">
          {vehicles.length === 0 ? (
            <EmptyState title="No vehicles yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {vehicles.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{v.name} · {v.plateNumber}</p>
                    <p className="text-xs text-muted">
                      Capacity {v.capacity}{v.driverName ? ` · Driver: ${v.driverName}` : ""}{v.driverPhone ? ` (${v.driverPhone})` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add a route</CardTitle>
            <CardDescription>Add stops and assign students from the route&apos;s own page.</CardDescription>
          </CardHeader>
          <CardContent><AddRouteForm vehicles={vehicles} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Routes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {routes.length === 0 ? (
            <EmptyState title="No routes yet" className="p-8" />
          ) : (
            <ul className="divide-y divide-border">
              {routes.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <Link href={`/dashboard/transport/routes/${r.id}`} className="flex-1">
                    <p className="font-medium text-foreground hover:text-accent">{r.name}</p>
                    <p className="text-xs text-muted">
                      {r.vehicle ? `${r.vehicle.name} · ` : "No vehicle assigned · "}
                      {r._count.stops} stop{r._count.stops === 1 ? "" : "s"}
                    </p>
                  </Link>
                  <Badge variant="accent">{r._count.assignments} student{r._count.assignments === 1 ? "" : "s"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
