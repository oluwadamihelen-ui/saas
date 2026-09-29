import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/require";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getDemoAccountStatus, DEMO_OWNER_EMAIL } from "@/lib/services/demo";
import { DemoAccountPanel } from "./demo-account-panel";

export const metadata: Metadata = { title: "Demo Account" };

export default async function DemoAccountPage() {
  await requireSuperAdmin();
  const existing = await getDemoAccountStatus();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Demo Account</h1>
      <Card>
        <CardHeader>
          <CardTitle>Prospect demo account</CardTitle>
          <CardDescription>
            A ready-to-share Otelum login with two hotel branches and realistic operational data -- rooms, guests,
            reservations at every stage, payments, expenses, housekeeping and maintenance -- so a prospect can click
            around and see a real hotel, not an empty account. Safe to re-run: if it already exists this just shows
            the same credentials again rather than creating a duplicate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DemoAccountPanel
            existing={
              existing
                ? { ownerEmail: existing.ownerEmail, password: existing.password, branchNames: existing.branches.map((b) => b.name) }
                : null
            }
            fallbackEmail={DEMO_OWNER_EMAIL}
          />
        </CardContent>
      </Card>
    </div>
  );
}
