"use client";

import { useActionState } from "react";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setActivePaymentProviderAction, type GatewayFormState } from "./payment-gateway-actions";
import type { PaymentGatewayProvider } from "@/generated/prisma/client";

const initialState: GatewayFormState = { status: "idle" };

const PROVIDER_LABELS: Record<PaymentGatewayProvider, string> = {
  PAYSTACK: "Paystack",
  FLUTTERWAVE: "Flutterwave",
  KORAPAY: "Korapay",
};

export function ActiveProviderForm({
  currentProvider,
  connectedProviders,
}: {
  currentProvider: PaymentGatewayProvider | null;
  connectedProviders: PaymentGatewayProvider[];
}) {
  const [state, formAction, isPending] = useActionState(setActivePaymentProviderAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-72 space-y-1.5">
        <Label htmlFor="activeProvider">Gateway used for &quot;Pay online&quot;</Label>
        <Select id="activeProvider" name="activeProvider" defaultValue={currentProvider ?? ""}>
          <option value="">None — simulated demo payments</option>
          {connectedProviders.map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
