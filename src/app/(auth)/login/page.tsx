import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

// Demo credentials are a local/dev convenience only -- never shown once the
// app is actually running in production, so a live login page never hints
// at real (or seeded) account passwords to the public.
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to manage your hotel&apos;s front desk, reservations and operations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-sm text-muted">
            New to Otelum?{" "}
            <Link href="/register" className="font-medium text-accent">
              Register your hotel
            </Link>
          </p>
          {SHOW_DEMO_ACCOUNTS && (
            <div className="mt-6 rounded-md bg-muted-surface p-3 text-xs text-muted">
              <p className="font-medium text-foreground">Demo accounts (password: Passw0rd!)</p>
              <p>Super Admin: admin@otelum.io</p>
              <p>Owner (Sunrise Hotel): owner@sunrisehotel.example</p>
              <p>Receptionist (Sunrise Hotel): reception@sunrisehotel.example</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
