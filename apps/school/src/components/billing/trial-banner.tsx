import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EffectiveSubscription } from "@/lib/billing/entitlements";

/// Rendered once in the dashboard layout for every role, so staff
/// understand why a feature might be restricted — but the "Choose a
/// plan"/"Upgrade" CTA only appears for whoever can actually reach
/// /dashboard/billing (billing.view), so a teacher never lands on a
/// permission error from clicking a banner button.
export function TrialBanner({ effective, canViewBilling }: { effective: EffectiveSubscription | null; canViewBilling: boolean }) {
  if (!effective) return null;
  const { effectiveStatus, isTrialing, trialDaysRemaining } = effective;
  const planName = effective.subscription.plan.name;

  if (isTrialing && trialDaysRemaining !== null) {
    const urgent = trialDaysRemaining <= 3;
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm sm:px-6 ${urgent ? "border-warning/30 bg-warning-soft text-foreground" : "border-border bg-muted-surface text-foreground"}`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-warning" />
          <span>
            <strong>{planName} Trial</strong> — {trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"} remaining.
          </span>
        </div>
        {canViewBilling && (
          <Button asChild size="sm" variant={urgent ? "primary" : "secondary"}>
            <Link href="/dashboard/billing">Choose a plan</Link>
          </Button>
        )}
      </div>
    );
  }

  if (effectiveStatus === "EXPIRED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-foreground sm:px-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <span>Your trial has ended. Choose a plan to continue using premium features.</span>
        </div>
        {canViewBilling && (
          <Button asChild size="sm">
            <Link href="/dashboard/billing">Choose a plan</Link>
          </Button>
        )}
      </div>
    );
  }

  if (effectiveStatus === "PAST_DUE") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-foreground sm:px-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <span>Your last payment didn&apos;t go through. Please update your billing to avoid losing access.</span>
        </div>
        {canViewBilling && (
          <Button asChild size="sm">
            <Link href="/dashboard/billing">Fix billing</Link>
          </Button>
        )}
      </div>
    );
  }

  if (effectiveStatus === "SUSPENDED") {
    return (
      <div className="flex items-center gap-2 border-b border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-foreground sm:px-6">
        <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
        <span>This account has been suspended. Contact Winfield support for help.</span>
      </div>
    );
  }

  return null;
}
