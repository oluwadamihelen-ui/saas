import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create your school" };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your school</CardTitle>
        <CardDescription>Step 1 of onboarding — create your account, then we&apos;ll walk through the rest.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
