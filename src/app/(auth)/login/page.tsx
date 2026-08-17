import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "@/components/marketing/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Log in to continue creating videos.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-brand-500 hover:text-brand-600">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/reset-password" className="text-muted-foreground hover:text-foreground">
            Forgot your password?
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
