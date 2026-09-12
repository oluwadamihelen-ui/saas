import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listStaff, listPendingInvites } from "@/lib/services/staff";
import { ResendInviteButton, ConvertInviteButton, RegenerateSetupLinkButton } from "./pending-invite-actions";

const STATUS_VARIANT = { ACTIVE: "success", INVITED: "warning", SUSPENDED: "danger" } as const;
const STATUS_LABEL = { ACTIVE: "Active", INVITED: "Password setup pending", SUSPENDED: "Suspended" } as const;

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  const canInvite = perms.has(PERMISSIONS.STAFF_INVITE);
  const params = await searchParams;

  const [{ staff, total, page, pageCount }, invites] = await Promise.all([
    listStaff(user.schoolId, params.page ? Number(params.page) : 1),
    listPendingInvites(user.schoolId),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Staff</h1>
          <p className="text-sm text-muted">{total} account{total === 1 ? "" : "s"}</p>
        </div>
        {canInvite && (
          <Button asChild>
            <Link href="/dashboard/staff/new">Add staff</Link>
          </Button>
        )}
      </div>

      {canInvite && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>Waiting for the staff member to open their link and set a password.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{invite.email}</p>
                    <p className="text-xs text-muted">{invite.role.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="accent">Pending</Badge>
                    {invite.purpose === "ACCOUNT_INVITATION" ? (
                      <>
                        <ResendInviteButton inviteId={invite.id} />
                        <ConvertInviteButton inviteId={invite.id} email={invite.email} />
                      </>
                    ) : (
                      <span className="text-xs text-muted">Password setup link — manage from the account below</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {staff.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted">
                      {member.email}
                      {member.staffId && <span> · {member.staffId}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="accent">{member.role.name}</Badge>
                  <Badge variant={STATUS_VARIANT[member.status]}>{STATUS_LABEL[member.status]}</Badge>
                  {canInvite && member.status === "INVITED" && (
                    <RegenerateSetupLinkButton userId={member.id} name={member.name} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Pagination page={page} pageCount={pageCount} basePath="/dashboard/staff" />
    </div>
  );
}
