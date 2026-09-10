import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS, ROLE_LABELS, HOTEL_ROLE_KEYS, PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { updateStaffMember, togglePermissionOverride } from "../actions";
import type { RoleKey } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Staff Member" };

const DEPARTMENTS = ["MANAGEMENT", "RECEPTION", "HOUSEKEEPING", "FINANCE", "MAINTENANCE", "SECURITY", "RESTAURANT"];

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission(PERMISSIONS.STAFF_MANAGE);
  const { id } = await params;

  const member = await prisma.hotelMember.findFirst({
    where: { id, hotelId: actor.hotelId },
    include: { user: { include: { permissionOverrides: { where: { hotelId: actor.hotelId } } } } },
  });
  if (!member) notFound();

  const overrideMap = new Map(member.user.permissionOverrides.map((o) => [o.permissionId, o.granted]));
  const defaultPerms = new Set(ROLE_DEFAULT_PERMISSIONS[member.role as Exclude<RoleKey, "SUPER_ADMIN">] ?? []);
  const permissions = await prisma.permission.findMany({ where: { key: { in: PERMISSION_CATALOG.map((p) => p.key) } } });

  const updateAction = updateStaffMember.bind(null, member.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{member.user.name}</h1>
        <p className="text-sm text-muted">{member.user.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role & employment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select name="role" defaultValue={member.role}>
                {HOTEL_ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select name="department" defaultValue={member.department ?? ""}>
                <option value="">None</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Employment status</Label>
              <Select name="employmentStatus" defaultValue={member.employmentStatus}>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="TERMINATED">Terminated</option>
              </Select>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permission overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted">
            {ROLE_LABELS[member.role]} has these permissions by default. Toggle to grant or revoke individual permissions for this person only.
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {permissions.map((p) => {
              const override = overrideMap.get(p.id);
              const effective = override !== undefined ? override : defaultPerms.has(p.key as never);
              return (
                <form key={p.id} action={togglePermissionOverride.bind(null, member.id, member.userId, p.id, !effective)} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="text-foreground">{p.description}</span>
                  <button type="submit" className={`rounded-full px-2 py-0.5 text-xs font-medium ${effective ? "bg-success-soft text-success" : "bg-muted-surface text-muted"}`}>
                    {effective ? "Granted" : "Denied"}
                  </button>
                </form>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
