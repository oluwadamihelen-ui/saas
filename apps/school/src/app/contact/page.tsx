import Link from "next/link";
import { Building2, LifeBuoy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata = { title: "Contact — Winfield" };

export default function ContactPage() {
  return (
    <MarketingPageShell
      eyebrow="Get in touch"
      title="How can we help?"
      description="Where you go next depends on what you need — pick the option below that fits."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
          <Building2 className="h-6 w-6 text-accent" />
          <h2 className="text-base font-semibold text-foreground">Talk to sales</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            Running more than one school, or need a custom plan? Tell us about your school or group and we&apos;ll put a plan together.
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/pricing#enterprise">Contact sales</Link>
          </Button>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
          <LifeBuoy className="h-6 w-6 text-accent" />
          <h2 className="text-base font-semibold text-foreground">Existing customer support</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            Already using Winfield? Sign in and send us a note from the Feedback section of your dashboard — it goes straight to your school&apos;s admins and our team.
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/login">Sign in to send feedback</Link>
          </Button>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
          <MessageCircle className="h-6 w-6 text-accent" />
          <h2 className="text-base font-semibold text-foreground">Not sure yet?</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            Take a look at how Winfield works and what&apos;s included in each plan before you decide.
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/pricing">See plans &amp; pricing</Link>
          </Button>
        </div>
      </div>
    </MarketingPageShell>
  );
}
