import type { Metadata } from "next";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { getCreditBalance } from "@/server/credits/ledger";
import { PLANS, CREDIT_PACKS, getStripePriceIdForPlan, getStripePriceIdForCreditPack } from "@/lib/plans";
import { isStripeConfigured } from "@/server/billing/stripe";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/dashboard/billing/checkout-button";
import { Zap, CheckCircle2, XCircle, Check } from "lucide-react";
import type { PlanId } from "@/generated/prisma/enums";

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

const PLAN_ORDER: PlanId[] = ["FREE", "STARTER", "CREATOR", "PRO"];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
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

  const currentPlanId: PlanId = subscription?.plan ?? "FREE";
  const plan = PLANS[currentPlanId];
  const stripeReady = isStripeConfigured();
  const hasBillingAccount = Boolean(subscription?.stripeCustomerId);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold">Billing & Credits</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your plan and track credit usage.</p>

      {checkout === "success" && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> Payment successful — your account has been updated.
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
          <XCircle className="h-4 w-4" /> Checkout was cancelled — no charge was made.
        </div>
      )}

      {!stripeReady && (
        <Card className="mt-4 border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-medium text-warning">Billing preview mode</p>
          <p className="mt-1 text-muted-foreground">
            Real payments aren&apos;t configured on this deployment yet. Plans and credits below are fully
            functional for testing the product experience, but upgrade/purchase buttons are disabled until
            Stripe is connected.
          </p>
        </Card>
      )}

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
            <div className="mt-4 flex gap-2">
              <Button href="/pricing" variant="secondary" className="flex-1">
                Compare plans
              </Button>
              {stripeReady && hasBillingAccount && (
                <CheckoutButton endpoint="/api/billing/portal" body={{}} variant="secondary" className="flex-1">
                  Manage billing
                </CheckoutButton>
              )}
            </div>
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

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold">Plans</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const isCurrent = id === currentPlanId;
            const priceId = id === "FREE" ? null : getStripePriceIdForPlan(id);
            return (
              <Card key={id} className={isCurrent ? "border-brand-400 ring-2 ring-brand-400" : undefined}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold">{p.name}</p>
                    {isCurrent && <Badge variant="brand">Current</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{p.monthlyCredits} credits / mo</p>
                  {id === "FREE" ? (
                    <p className="mt-4 text-xs text-muted-foreground">Default plan — no payment needed.</p>
                  ) : !stripeReady || !priceId ? (
                    <p className="mt-4 text-xs text-muted-foreground">
                      {!stripeReady ? "Preview mode" : "Pricing coming soon"}
                    </p>
                  ) : isCurrent ? (
                    <p className="mt-4 text-xs text-muted-foreground">You&apos;re on this plan.</p>
                  ) : (
                    <CheckoutButton
                      endpoint="/api/billing/checkout"
                      body={{ plan: id }}
                      size="sm"
                      className="mt-4 w-full"
                    >
                      Upgrade
                    </CheckoutButton>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold">Buy extra credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">One-time top-ups on top of your plan&apos;s monthly credits.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pack) => {
            const priceId = getStripePriceIdForCreditPack(pack.id);
            return (
              <Card key={pack.id} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="font-display font-semibold">{pack.name}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                    <Zap className="h-4 w-4" /> {pack.credits}
                  </span>
                </div>
                {stripeReady && priceId ? (
                  <CheckoutButton
                    endpoint="/api/billing/credit-packs/checkout"
                    body={{ packId: pack.id }}
                    variant="secondary"
                    size="sm"
                    className="mt-4 w-full"
                  >
                    <Check className="h-4 w-4" /> Buy
                  </CheckoutButton>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {!stripeReady ? "Preview mode" : "Pricing coming soon"}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
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
