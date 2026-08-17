import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RequestResetForm } from "@/components/marketing/request-reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send you a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <RequestResetForm />
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Back to log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
