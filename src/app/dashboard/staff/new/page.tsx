import Link from "next/link";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InviteStaffForm } from "@/components/dashboard/invite-staff-form";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listAssignableRoles } from "@/lib/services/staff";
import { DirectCreateForm } from "./direct-create-form";
import { sendStaffInvite } from "../actions";

export default async function CreateNewUserPage() {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);
  const roles = await listAssignableRoles(user.schoolId);

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create new user</h1>
          <p className="text-sm text-muted">Add one staff member now, or use Multiple Users Registration to add several at once.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard/staff/bulk">Multiple users registration</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="direct">
            <TabsList>
              <TabsTrigger value="direct">Admin direct creation</TabsTrigger>
              <TabsTrigger value="invite">Invite via link</TabsTrigger>
            </TabsList>

            <TabsContent value="direct">
              <div className="mb-4 space-y-1">
                <CardTitle>Create the account now</CardTitle>
                <CardDescription>
                  Creates the account immediately, with the role applied right away. Schoolum generates a secure password
                  setup link for you to copy and share with them — there&apos;s no email provider, so nothing is sent
                  automatically. They can&apos;t sign in until they&apos;ve used it to set a password.
                </CardDescription>
              </div>
              <DirectCreateForm roles={roles} />
            </TabsContent>

            <TabsContent value="invite">
              <div className="mb-4 space-y-1">
                <CardTitle>Generate an invitation link</CardTitle>
                <CardDescription>
                  Generates a secure invitation link for you to share with the staff member. They complete their own
                  profile and choose their own password when they open it — no account exists until they do.
                </CardDescription>
              </div>
              <InviteStaffForm roles={roles} action={sendStaffInvite} />
              <p className="mt-3 text-xs text-muted">
                Once created, find the link to copy on the <Link href="/dashboard/staff" className="text-accent hover:underline">staff directory</Link>&apos;s pending invitations list.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
