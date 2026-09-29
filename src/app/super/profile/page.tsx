import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/require";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { UpdateProfileForm, ChangePasswordForm } from "@/components/account/profile-forms";

export const metadata: Metadata = { title: "My Profile" };

export default async function SuperAdminProfilePage() {
  const sessionUser = await requireSuperAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted">Platform Super Admin</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdateProfileForm name={user.name} phone={user.phone ?? ""} />
          <p className="mt-4 text-xs text-muted">Email: {user.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
