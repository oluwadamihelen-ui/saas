import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm, PasswordForm } from "./profile-forms";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile & Billing</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            name={user.name}
            phone={user.phone ?? ""}
            company={user.company ?? ""}
            country={user.country ?? ""}
            addressLine1={user.addressLine1 ?? ""}
            city={user.city ?? ""}
            stateProvince={user.stateProvince ?? ""}
            postalCode={user.postalCode ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
