import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register your hotel" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect(session.user.isSuperAdmin ? "/super" : "/app");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your hotel</CardTitle>
        <CardDescription>Create your property profile and owner account to start managing reservations today.</CardDescription>
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
