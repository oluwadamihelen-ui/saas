import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS, PERMISSION_CATALOG } from "@/lib/permissions";
import { listRolesForSchool } from "@/lib/services/role-permissions";
import { RolePermissionsEditor } from "./role-permissions-editor";

export default async function RolesPage() {
  const user = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const roles = await listRolesForSchool(user.schoolId);

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manage Roles</h1>
        <p className="text-sm text-muted">Decide exactly what each role at your school is allowed to do.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role permissions</CardTitle>
          <CardDescription>
            Pick a role, then check or uncheck what it can access. Changes apply immediately to everyone holding that
            role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RolePermissionsEditor roles={roles} catalog={PERMISSION_CATALOG} currentUserRoleKey={user.role} />
        </CardContent>
      </Card>
    </div>
  );
}
