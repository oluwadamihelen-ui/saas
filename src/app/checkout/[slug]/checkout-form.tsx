"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { submitCheckout, type CheckoutFormState } from "./actions";

interface PricingLine {
  id: string;
  type: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
}

interface HostingPlanOption {
  id: string;
  name: string;
  priceMonthly: number;
}

const initialState: CheckoutFormState = { status: "idle" };

export function CheckoutForm({
  applicationId,
  applicationName,
  pricing,
  hostingPlans,
  defaultEmail,
  defaultName,
}: {
  applicationId: string;
  applicationName: string;
  pricing: PricingLine[];
  hostingPlans: HostingPlanOption[];
  defaultEmail: string;
  defaultName: string;
}) {
  const [state, formAction, isPending] = useActionState(submitCheckout, initialState);
  const [includeInstallation, setIncludeInstallation] = React.useState(false);
  const [deploymentType, setDeploymentType] = React.useState<"CUSTOMER_SERVER" | "PLATFORM_HOSTING" | "MANAGED">(
    "MANAGED"
  );
  const [hostingPlanId, setHostingPlanId] = React.useState(hostingPlans[0]?.id ?? "");
  const [wantsDomain, setWantsDomain] = React.useState(false);

  const license = pricing.find((p) => p.type === "LICENSE");
  const installation = pricing.find((p) => p.type === "INSTALLATION");
  const selectedHostingPlan = hostingPlans.find((p) => p.id === hostingPlanId);

  const subtotal =
    (license?.amount ?? 0) +
    (includeInstallation && installation ? installation.amount : 0) +
    (deploymentType === "PLATFORM_HOSTING" && selectedHostingPlan ? selectedHostingPlan.priceMonthly : 0);

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="applicationId" value={applicationId} />

      <div className="space-y-8">
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Add-ons</h2>
          {installation ? (
            <label className="mt-4 flex items-start gap-3 rounded-md border border-border p-4">
              <input
                type="checkbox"
                name="includeInstallation"
                checked={includeInstallation}
                onChange={(e) => setIncludeInstallation(e.target.checked)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Professional installation</p>
                <p className="text-xs text-muted">We install and configure the application for you.</p>
              </div>
              <span className="text-sm font-medium text-foreground">{formatCurrency(installation.amount)}</span>
            </label>
          ) : (
            <p className="mt-4 text-sm text-muted">No optional add-ons for this application.</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Deployment</h2>
          <div className="mt-4 space-y-3">
            {[
              { value: "MANAGED", title: "Request managed deployment", description: "Our team deploys and configures everything for you." },
              { value: "PLATFORM_HOSTING", title: "Use hosting from us", description: "We provision a hosting account and deploy there." },
              { value: "CUSTOMER_SERVER", title: "Deploy to my server", description: "Provide your server details and we deploy remotely." },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${deploymentType === opt.value ? "border-accent bg-accent-soft" : "border-border"}`}
              >
                <input
                  type="radio"
                  name="deploymentType"
                  value={opt.value}
                  checked={deploymentType === opt.value}
                  onChange={() => setDeploymentType(opt.value as never)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.title}</p>
                  <p className="text-xs text-muted">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          {deploymentType === "PLATFORM_HOSTING" && (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="hostingPlanId">Hosting plan</Label>
              <Select
                id="hostingPlanId"
                name="hostingPlanId"
                value={hostingPlanId}
                onChange={(e) => setHostingPlanId(e.target.value)}
              >
                {hostingPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {formatCurrency(plan.priceMonthly)}/mo
                  </option>
                ))}
              </Select>
            </div>
          )}

          {deploymentType === "CUSTOMER_SERVER" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="serverHost">Server hostname or IP</Label>
                <Input id="serverHost" name="serverHost" placeholder="203.0.113.10" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="serverPort">SSH port</Label>
                <Input id="serverPort" name="serverPort" type="number" defaultValue={22} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="controlPanel">Control panel (optional)</Label>
                <Input id="controlPanel" name="controlPanel" placeholder="cPanel, Plesk, none..." />
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                We&apos;ll email you secure instructions to grant temporary deployment access — never share passwords
                in this form.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Domain</h2>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={wantsDomain} onChange={(e) => setWantsDomain(e.target.checked)} />
            I want to use a specific domain for this deployment
          </label>
          {wantsDomain && (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="domainName">Domain name</Label>
              <Input id="domainName" name="domainName" placeholder="mybusiness.com" />
              <p className="text-xs text-muted">New domains are registered automatically if available.</p>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Billing details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="billingName">Full name</Label>
              <Input id="billingName" name="billingName" defaultValue={defaultName} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billingEmail">Email</Label>
              <Input id="billingEmail" name="billingEmail" type="email" defaultValue={defaultEmail} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billingPhone">Phone</Label>
              <Input id="billingPhone" name="billingPhone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billingCompany">Company</Label>
              <Input id="billingCompany" name="billingCompany" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billingCountry">Country</Label>
              <Input id="billingCountry" name="billingCountry" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="billingAddress">Billing address</Label>
              <Textarea id="billingAddress" name="billingAddress" rows={2} />
            </div>
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Order Summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{applicationName} License</span>
              <span className="font-medium">{formatCurrency(license?.amount ?? 0)}</span>
            </div>
            {includeInstallation && installation && (
              <div className="flex justify-between">
                <span className="text-muted">Installation</span>
                <span className="font-medium">{formatCurrency(installation.amount)}</span>
              </div>
            )}
            {deploymentType === "PLATFORM_HOSTING" && selectedHostingPlan && (
              <div className="flex justify-between">
                <span className="text-muted">{selectedHostingPlan.name} Hosting (monthly)</span>
                <span className="font-medium">{formatCurrency(selectedHostingPlan.priceMonthly)}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold">
            <span>Total due today</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={isPending}>
            {isPending ? "Processing..." : "Continue to Payment"}
          </Button>
          {state.status === "error" && <p className="mt-3 text-sm text-danger">{state.message}</p>}
          <p className="mt-4 text-xs text-muted">
            You&apos;ll be redirected to our secure payment page. Recurring items are billed automatically going
            forward.
          </p>
        </div>
      </aside>
    </form>
  );
}
