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
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to manage your applications, deployments, and orders.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-accent">
            Create one
          </Link>
        </p>
        <div className="mt-6 rounded-md bg-muted-surface p-3 text-xs text-muted">
          <p className="font-medium text-foreground">Demo accounts</p>
          <p>Admin: admin@forgecart.example / Passw0rd!</p>
          <p>Customer: sarah@brightretail.com / Passw0rd!</p>
        </div>
      </CardContent>
    </Card>
  );
}
