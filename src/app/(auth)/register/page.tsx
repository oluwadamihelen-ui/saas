import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register your hotel" };

export default function RegisterPage() {
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
