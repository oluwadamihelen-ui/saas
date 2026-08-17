import type { Metadata } from "next";
import { auth } from "@/server/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AccountForm } from "@/components/dashboard/account-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  const user = session!.user;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your account details.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>This information is used across Storyloom.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountForm name={user.name ?? ""} email={user.email ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
