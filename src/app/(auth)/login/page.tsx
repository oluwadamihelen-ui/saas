import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

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
            New to StayOS?{" "}
            <Link href="/register" className="font-medium text-accent">
              Register your hotel
            </Link>
          </p>
          <div className="mt-6 rounded-md bg-muted-surface p-3 text-xs text-muted">
            <p className="font-medium text-foreground">Demo accounts (password: Passw0rd!)</p>
            <p>Super Admin: admin@stayos.example</p>
            <p>Owner (Sunrise Hotel): owner@sunrisehotel.example</p>
            <p>Receptionist (Sunrise Hotel): reception@sunrisehotel.example</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
