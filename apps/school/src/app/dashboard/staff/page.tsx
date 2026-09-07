import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { InviteStaffForm } from "@/components/dashboard/invite-staff-form";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listStaff, listRoles, listPendingInvites } from "@/lib/services/staff";
import { sendStaffInvite } from "./actions";

export default async function StaffPage() {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  const canInvite = perms.has(PERMISSIONS.STAFF_INVITE);

  const [staff, roles, invites] = await Promise.all([
    listStaff(user.schoolId),
    listRoles(user.schoolId),
    listPendingInvites(user.schoolId),
  ]);
  const invitableRoles = roles.filter((r) => !["SCHOOL_OWNER", "PARENT", "STUDENT"].includes(r.key));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Staff</h1>
        <p className="text-sm text-muted">{staff.length} active account{staff.length === 1 ? "" : "s"}</p>
      </div>

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a staff member</CardTitle>
            <CardDescription>They&apos;ll get a link to set their own password and activate the account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InviteStaffForm roles={invitableRoles} action={sendStaffInvite} />
            {invites.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{invite.email}</p>
                      <p className="text-xs text-muted">{invite.role.name}</p>
                    </div>
                    <Badge variant="accent">Pending</Badge>
                    <code className="max-w-[16rem] truncate text-xs text-muted">/invite/{invite.token}</code>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {staff.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted">{member.email}</p>
                  </div>
                </div>
                <Badge variant="accent">{member.role.name}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
