import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Schoolum</CardTitle>
        <CardDescription>The intelligent operating system for your school.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted">
          Setting up a new school?{" "}
          <Link href="/register" className="font-medium text-accent">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
