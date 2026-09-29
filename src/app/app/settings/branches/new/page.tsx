import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BranchForm } from "./branch-form";

export const metadata: Metadata = { title: "Add a hotel branch" };

export default async function NewBranchPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a hotel branch</CardTitle>
          <CardDescription>
            Creates a new property under your account. You&apos;ll be able to switch between your hotels from the
            switcher in the top bar, and each one&apos;s reservations, guests and payments stay fully separate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BranchForm />
        </CardContent>
      </Card>
    </div>
  );
}
