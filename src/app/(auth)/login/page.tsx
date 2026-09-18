import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { listSchoolsForStudentLogin } from "@/lib/services/public-schools";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
// The school dropdown must reflect newly-onboarded schools immediately —
// without this, Next.js would bake the list into the page at build time
// and only refresh it on the next deploy.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const schools = await listSchoolsForStudentLogin();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Schoolum</CardTitle>
        <CardDescription>The intelligent operating system for your school.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <LoginForm schools={schools} />
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
