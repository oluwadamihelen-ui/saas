import Link from "next/link";
import {
  MessageCircle,
  Package,
  Boxes,
  Users,
  CreditCard,
  Sparkles,
  BarChart3,
  Megaphone,
  Check,
  ArrowRight,
} from "lucide-react";
import { MamaLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLAN_DEFS } from "@/lib/plans";

const features = [
  {
    icon: MessageCircle,
    title: "WhatsApp selling",
    description:
      "Customers browse products, add to cart and check out right inside WhatsApp — no app to download.",
  },
  {
    icon: Package,
    title: "Orders",
    description: "Every order, from every channel, tracked from pending to delivered in one place.",
  },
  {
    icon: Boxes,
    title: "Inventory",
    description: "Real-time stock levels with automatic low-stock alerts so you never oversell.",
  },
  {
    icon: Users,
    title: "Customers",
    description: "A CRM that quietly builds itself from every order — VIPs, regulars and lapsed customers.",
  },
  {
    icon: CreditCard,
    title: "Payments",
    description: "Accept card, bank transfer and USSD payments with Paystack, verified server-side.",
  },
  {
    icon: Sparkles,
    title: "Mama AI",
    description: "Ask Mama how business is going. Get real answers from your real numbers, instantly.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Sales, top products, and customer trends — the numbers that actually run your business.",
  },
  {
    icon: Megaphone,
    title: "Marketing",
    description: "AI-drafted messages to win back customers and promote what's selling, ready to review.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <MamaLogo className="text-lg" />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Product</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Button asChild size="sm">
              <Link href="/register">Start for free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Built for African businesses, WhatsApp-first
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-6xl">
          Your business. One intelligent platform.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          MAMA helps African businesses sell, manage customers, track orders, control inventory and
          grow — starting with WhatsApp.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/shop/mama-foodstuff">See how it works</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Free plan available forever
        </p>
      </section>

      {/* Product screenshot placeholder */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-4">
            <StatPreview label="Today's Sales" value="₦186,500" />
            <StatPreview label="Orders" value="14" />
            <StatPreview label="Customers" value="9" />
            <StatPreview label="Avg. Order Value" value="₦13,321" />
          </div>
          <div className="mx-6 mb-6 rounded-xl bg-primary/5 p-4 text-sm">
            <span className="font-medium text-primary">Mama AI insight — </span>
            <span className="text-foreground/80">
              Your rice products generated 43% of this week&apos;s revenue. Consider restocking 10kg Rice —
              it may run out within 5 days.
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Everything your business needs. Nothing it doesn&apos;t.</h2>
          <p className="mt-3 text-muted-foreground">Sell more. Manage less.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="border-border/80">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Simple, honest pricing</h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade as your business grows.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLAN_DEFS.map((plan) => (
            <Card key={plan.key} className={plan.key === "GROWTH" ? "border-primary shadow-lg" : ""}>
              <CardContent className="pt-6">
                {plan.key === "GROWTH" && (
                  <div className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold">
                  {plan.priceMonthly === 0 ? "₦0" : `₦${plan.priceMonthly.toLocaleString()}`}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={plan.key === "GROWTH" ? "default" : "outline"}>
                  <Link href="/register">Start for free</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto w-full max-w-3xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Frequently asked questions</h2>
        <div className="mt-10 space-y-6">
          {[
            {
              q: "Do my customers need to install anything?",
              a: "No. Customers order through WhatsApp, which they already use. Nobody needs to create a MAMA account to buy from you.",
            },
            {
              q: "Which WhatsApp integration do you use?",
              a: "MAMA connects only through Meta's official WhatsApp Business Platform (Cloud API) — never unofficial automation or QR-session tools.",
            },
            {
              q: "How do I get paid?",
              a: "Payments are processed through Paystack. Every payment is verified server-side before an order is marked paid, so you're never at risk from a spoofed payment.",
            },
            {
              q: "Can Mama AI see other businesses' data?",
              a: "Never. Every business is isolated at the database level — Mama AI only ever sees your business's own data.",
            },
          ].map((item) => (
            <div key={item.q} className="border-b border-border pb-6">
              <h3 className="font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-24">
        <div className="rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold tracking-tight">Mama helps you run your business.</h2>
          <p className="mx-auto mt-3 max-w-md text-primary-foreground/80">
            Join African businesses selling smarter with MAMA — starting free, today.
          </p>
          <Button asChild size="lg" variant="accent" className="mt-8">
            <Link href="/register">Start my business</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <MamaLogo className="text-base" />
          <p>© {new Date().getFullYear()} MAMA. The business OS built for Africa.</p>
        </div>
      </footer>
    </div>
  );
}

function StatPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
