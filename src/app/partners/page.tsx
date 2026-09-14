import Link from "next/link";
import { Link2, Handshake, Wallet, ShoppingCart, Repeat } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Button } from "@/components/ui/button";
import { getPartnerCommissionConfig } from "@/lib/services/partner-commissions";

export const metadata = { title: "Partner Program — Schoolum" };

const HOW_IT_WORKS = [
  {
    icon: Handshake,
    title: "1. Apply and get approved",
    description: "Submit a short application. Once approved, you get your own unique Partner referral link and code.",
  },
  {
    icon: Link2,
    title: "2. Share your referral link",
    description: "Send it to school owners and administrators you know. Anyone who signs up through it is attributed to you.",
  },
  {
    icon: Wallet,
    title: "3. Earn when the school pays",
    description: "As soon as Schoolum actually receives a payment from that school, your commission is calculated automatically.",
  },
];

/// Live from PartnerCommissionConfig, not a hardcoded marketing figure —
/// this page never goes stale if a Super Admin changes the rates later.
export default async function PartnersPage() {
  const config = await getPartnerCommissionConfig();
  const buyRatePercent = config.buyCommissionRateBps / 100;
  const rentRatePercent = config.rentCommissionRateBps / 100;

  return (
    <MarketingPageShell
      eyebrow="Schoolum Partner Program"
      title="Earn commission for every school you bring to Schoolum"
      description="Refer schools to Schoolum and earn a share of what they actually pay us — whether they subscribe or purchase outright."
    >
      <div className="flex justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/partner-apply">Apply to become a Partner</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/login">Already a Partner? Sign in</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {HOW_IT_WORKS.map((step) => (
          <div key={step.title} className="rounded-lg border border-border bg-surface p-6">
            <step.icon className="h-6 w-6 text-accent" />
            <h2 className="mt-4 text-base font-semibold text-foreground">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">Two ways schools work with Schoolum</h2>
        <p className="mx-auto max-w-xl text-center text-sm text-muted">
          Most schools subscribe, but some prefer to purchase Schoolum outright — you earn a commission either way.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-6">
            <Repeat className="h-6 w-6 text-accent" />
            <h3 className="mt-4 text-base font-semibold text-foreground">Rent (subscription)</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The school pays monthly or yearly, like any of our regular plans. You earn a commission on every renewal payment for as
              long as they stay subscribed.
            </p>
            <p className="mt-4 text-2xl font-semibold text-foreground">{rentRatePercent}% commission</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6">
            <ShoppingCart className="h-6 w-6 text-accent" />
            <h3 className="mt-4 text-base font-semibold text-foreground">Buy (outright purchase)</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The school purchases Schoolum outright — as a one-time payment or in installments — instead of a recurring
              subscription. This is arranged directly with our sales team.
            </p>
            <p className="mt-4 text-2xl font-semibold text-foreground">{buyRatePercent}% commission</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted-surface/60 p-6 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Commissions become available to withdraw {config.holdDays} days after the school&apos;s payment is confirmed, to allow for
          refunds or chargebacks. Payouts are processed manually by our team once you request a withdrawal from your Partner
          dashboard.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted-surface/60 p-6 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Have a school in mind that wants to purchase Schoolum outright?{" "}
          <Link href="/pricing#enterprise" className="font-medium text-accent hover:underline">
            Point them to our sales team
          </Link>{" "}
          and let us know you referred them — or, once approved as a Partner, share your own referral link and we&apos;ll attribute
          it to you automatically.
        </p>
      </div>
    </MarketingPageShell>
  );
}
