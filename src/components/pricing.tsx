import { Check } from "lucide-react";
import { Card, LinkButton, Button, Badge } from "@/components/ui";
import { FREE_FEATURES, PRICING, PRO_FEATURES } from "@/config/plans";
import { startCheckoutAction } from "@/actions/billing";

const ngn = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function PricingCards({ mode, currentPlan }: { mode: "public" | "app"; currentPlan?: "FREE" | "PRO" }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="flex flex-col p-6">
        <h3 className="font-semibold">Free</h3>
        <p className="mt-3 text-3xl font-semibold">$0</p>
        <p className="text-sm text-muted">Calculate and journal, forever.</p>
        <ul className="mt-5 flex-1 space-y-2 text-sm">{FREE_FEATURES.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-up" />{f}</li>)}</ul>
        {mode === "public" ? <LinkButton href="/register" variant="secondary" className="mt-6">Start free</LinkButton> : <Badge className="mt-6 self-start">{currentPlan === "FREE" ? "Current plan" : "Included"}</Badge>}
      </Card>
      {(["MONTHLY", "ANNUAL"] as const).map((k) => (
        <Card key={k} className={`flex flex-col p-6 ${k === "ANNUAL" ? "border-accent/60" : ""}`}>
          <h3 className="flex items-center gap-2 font-semibold">{PRICING[k].label} {k === "ANNUAL" && <Badge tone="accent">Best value</Badge>}</h3>
          <p className="mt-3 text-3xl font-semibold">${PRICING[k].usd}<span className="text-base font-normal text-muted">/{k === "MONTHLY" ? "month" : "year"}</span></p>
          <p className="text-sm text-muted">or {ngn(PRICING[k].ngn)} · {k === "ANNUAL" ? `about $${(PRICING[k].usd / 12).toFixed(2)}/month` : "cancel any time"}</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm">{PRO_FEATURES.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-up" />{f}</li>)}</ul>
          {mode === "public" ? <LinkButton href="/register" className="mt-6">Get Pro</LinkButton> : (
            <form action={startCheckoutAction} className="mt-6 grid grid-cols-2 gap-2">
              <input type="hidden" name="interval" value={k} />
              <Button name="currency" value="USD">Pay ${PRICING[k].usd}</Button>
              <Button name="currency" value="NGN" variant="secondary">Pay {ngn(PRICING[k].ngn)}</Button>
            </form>
          )}
        </Card>
      ))}
    </div>
  );
}
