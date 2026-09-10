import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/// Server-rendered — the frontend gate is UX only (spec section 30's own
/// framing, echoed in entitlements.ts's requireFeature doc comment); the
/// real enforcement is the requireFeature()/require*Capacity() call in the
/// service layer this page's actions ultimately go through.
export function FeatureLocked({
  title = "This feature isn't included in your plan",
  description,
  canViewBilling,
}: {
  title?: string;
  description: string;
  canViewBilling: boolean;
}) {
  return (
    <EmptyState
      icon={<Lock className="h-8 w-8" />}
      title={title}
      description={description}
      action={
        canViewBilling ? (
          <Button asChild size="sm">
            <Link href="/dashboard/billing">Upgrade plan</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
