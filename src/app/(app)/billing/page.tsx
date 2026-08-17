import type { Metadata } from "next";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { getCreditBalance } from "@/server/credits/ledger";
import { PLANS } from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export const metadata: Metadata = { title: "Billing" };

const REASON_LABEL: Record<string, string> = {
  SIGNUP_GRANT: "Signup bonus",
  MONTHLY_GRANT: "Monthly grant",
  PURCHASE: "Credit purchase",
  SCRIPT_GENERATION: "Script generation",
  STORYBOARD_GENERATION: "Storyboard generation",
  IMAGE_GENERATION: "Image generation",
  VIDEO_GENERATION: "Video generation",
  VOICE_GENERATION: "Voice generation",
  MUSIC_GENERATION: "Music generation",
  RENDER: "Video render",
  REFUND: "Refund",
  ADMIN_ADJUSTMENT: "Adjustment",
};

export default async function BillingPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [balance, subscription, ledger] = await Promise.all([
    getCreditBalance(userId),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.creditLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const plan = PLANS[subscription?.plan ?? "FREE"];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold">Billing & Credits</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your plan and track credit usage.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="font-display text-xl font-bold">{plan.name}</p>
              <Badge variant="brand">{plan.monthlyCredits} credits / mo</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Up to {Math.round(plan.maxVideoLengthSeconds / 60)} min videos, {plan.maxExportResolution.toUpperCase()} export.
            </p>
            <Button href="/pricing" variant="secondary" className="mt-4 w-full">
              Compare plans
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-ember-500" />
              <p className="font-display text-3xl font-bold">{balance}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Credits are consumed by AI generation steps — script, storyboard, images, animation, voice, music and rendering.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Credit history</CardTitle>
          <CardDescription>Every credit grant and charge on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No credit activity yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {ledger.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{REASON_LABEL[entry.reason] ?? entry.reason}</p>
                    <p className="text-xs text-muted-foreground">{entry.createdAt.toLocaleString()}</p>
                  </div>
                  <span className={entry.amount >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
                    {entry.amount >= 0 ? "+" : ""}{entry.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
