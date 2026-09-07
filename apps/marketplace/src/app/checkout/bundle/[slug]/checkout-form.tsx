"use client";

import { useActionState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { submitBundleCheckout, type BundleCheckoutFormState } from "./actions";

interface BundleItemLine {
  id: string;
  label: string;
  quantity: number;
}

const initialState: BundleCheckoutFormState = { status: "idle" };

export function BundleCheckoutForm({
  bundleId,
  bundleName,
  price,
  currency,
  items,
  defaultEmail,
  defaultName,
}: {
  bundleId: string;
  bundleName: string;
  price: number;
  currency: string;
  items: BundleItemLine[];
  defaultEmail: string;
  defaultName: string;
}) {
  const [state, formAction, isPending] = useActionState(submitBundleCheckout, initialState);

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="bundleId" value={bundleId} />

      <div className="space-y-8">
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
              <span className="text-muted">{bundleName}</span>
              <span className="font-medium">{formatCurrency(price, currency)}</span>
            </div>
            <ul className="space-y-1 text-xs text-muted">
              {items.map((item) => (
                <li key={item.id}>
                  {item.label}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 space-y-1.5 border-t border-border pt-4">
            <Label htmlFor="couponCode">Coupon code (optional)</Label>
            <Input id="couponCode" name="couponCode" placeholder="e.g. WELCOME10" className="uppercase placeholder:normal-case" />
          </div>

          <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold">
            <span>Total due today</span>
            <span>{formatCurrency(price, currency)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">A valid coupon is applied to your total on the next step.</p>
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={isPending}>
            {isPending ? "Processing..." : "Continue to Payment"}
          </Button>
          {state.status === "error" && <p className="mt-3 text-sm text-danger">{state.message}</p>}
          <p className="mt-4 text-xs text-muted">You&apos;ll be redirected to our secure payment page.</p>
        </div>
      </aside>
    </form>
  );
}
