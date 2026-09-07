import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { StaffForm } from "./staff-form";
import { togglePermissionOverride, suspendStaffMember, reactivateStaffMember } from "./actions";

export const metadata: Metadata = { title: "Staff" };

export default async function AdminStaffPage() {
  await requireRole("SUPER_ADMIN");

  const [staff, permissions] = await Promise.all([
    prisma.user.findMany({
      where: { role: { key: { in: ["STAFF", "SUPER_ADMIN"] } } },
      orderBy: { createdAt: "asc" },
      include: { role: { include: { permissions: true } }, permissionOverrides: true },
    }),
    prisma.permission.findMany({ orderBy: { category: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
        <p className="mt-1 text-sm text-muted">Manage operations staff and fine-tune their individual permissions.</p>
      </div>

      <Card>
        <CardContent>
          <StaffForm />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {staff.map((member) => {
          const baseGranted = new Set(member.role.permissions.map((p) => p.permissionId));
          const grantedOverrides = new Set(member.permissionOverrides.filter((o) => o.granted).map((o) => o.permissionId));
          const revokedOverrides = new Set(member.permissionOverrides.filter((o) => !o.granted).map((o) => o.permissionId));

          return (
            <Card key={member.id}>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{member.name}</p>
                    <p className="text-xs text-muted">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role.key === "SUPER_ADMIN" ? "accent" : "neutral"}>{member.role.name}</Badge>
                    <Badge variant={member.status === "ACTIVE" ? "success" : "danger"}>{member.status}</Badge>
                    {member.role.key !== "SUPER_ADMIN" &&
                      (member.status === "ACTIVE" ? (
                        <form action={suspendStaffMember.bind(null, member.id)}>
                          <Button type="submit" size="sm" variant="destructive">
                            Suspend
                          </Button>
                        </form>
                      ) : (
                        <form action={reactivateStaffMember.bind(null, member.id)}>
                          <Button type="submit" size="sm" variant="secondary">
                            Reactivate
                          </Button>
                        </form>
                      ))}
                  </div>
                </div>

                {member.role.key === "STAFF" && (
                  <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {permissions.map((permission) => {
                      const isRevoked = revokedOverrides.has(permission.id);
                      const isExtraGranted = grantedOverrides.has(permission.id);
                      const checked = isRevoked ? false : isExtraGranted || baseGranted.has(permission.id);
                      return (
                        <form key={permission.id} action={togglePermissionOverride.bind(null, member.id, permission.id, !checked)}>
                          <button
                            type="submit"
                            className={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs ${checked ? "border-accent bg-accent-soft text-accent" : "border-border text-muted"}`}
                          >
                            {permission.key}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted">{PERMISSION_CATALOG.length} permissions available across the platform.</p>
    </div>
  );
}
