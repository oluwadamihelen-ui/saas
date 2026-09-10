import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listAllAccountsBrief } from "@/lib/services/administration-users";
import { ResetPasswordForm } from "./form";

export default async function ResetPasswordPage() {
  const user = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const accounts = await listAllAccountsBrief(user.schoolId);

  return (
    <div className="max-w-lg space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard/administration/users">&larr; All Users</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset Password</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>The user will need this new password the next time they sign in — it isn&apos;t emailed to them.</CardDescription>
        </CardHeader>
        <CardContent><ResetPasswordForm accounts={accounts} /></CardContent>
      </Card>
    </div>
  );
}
