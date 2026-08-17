import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmResetForm } from "@/components/marketing/confirm-reset-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ConfirmResetPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <ConfirmResetForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
