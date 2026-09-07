import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSchoolUser } from "@/lib/auth/require";
import { listRoles, listPendingInvites } from "@/lib/services/staff";
import { InviteStaffForm } from "@/components/dashboard/invite-staff-form";
import { OnboardingStepper } from "../stepper";
import { sendStaffInvite } from "./actions";
import { FinishButton } from "./finish-button";

export default async function InviteStaffPage() {
  const user = await requireSchoolUser();
  const [allRoles, invites] = await Promise.all([
    listRoles(user.schoolId),
    listPendingInvites(user.schoolId),
  ]);
  const invitableRoles = allRoles.filter((r) => !["SCHOOL_OWNER", "PARENT", "STUDENT"].includes(r.key));

  return (
    <div className="space-y-6">
      <OnboardingStepper current="invite-staff" />
      <Card>
        <CardHeader>
          <CardTitle>Invite your team</CardTitle>
          <CardDescription>
            Send each staff member an invite link. There&apos;s no email delivery configured yet, so copy the
            link and share it directly — they&apos;ll set their own password to activate the account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
      <FinishButton />
    </div>
  );
}
