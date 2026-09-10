import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuestForm } from "../guest-form";
import { createGuestAction } from "../actions";

export const metadata: Metadata = { title: "New Guest" };

export default async function NewGuestPage() {
  await requirePermission(PERMISSIONS.GUESTS_MANAGE);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Guest</h1>
      <Card>
        <CardHeader>
          <CardTitle>Guest details</CardTitle>
        </CardHeader>
        <CardContent>
          <GuestForm action={createGuestAction} submitLabel="Create Guest" />
        </CardContent>
      </Card>
    </div>
  );
}
