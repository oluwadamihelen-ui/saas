"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { registerDomain, type RegisterDomainState } from "./actions";

const initial: RegisterDomainState = { status: "idle" };

export function RegisterDomainForm({
  domainName,
  registrationPricePerYear,
  currency,
}: {
  domainName: string;
  registrationPricePerYear: number;
  currency: string;
}) {
  const [state, formAction, isPending] = useActionState(registerDomain, initial);
  const [years, setYears] = React.useState(1);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="domainName" value={domainName} />
      <div className="space-y-1.5">
        <Label htmlFor="years">Registration length</Label>
        <Select id="years" name="years" value={years} onChange={(e) => setYears(Number(e.target.value))}>
          {[1, 2, 3, 5, 10].map((y) => (
            <option key={y} value={y}>
              {y} {y === 1 ? "year" : "years"}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center justify-between rounded-md bg-muted-surface p-3 text-sm">
        <span className="text-muted">Total</span>
        <span className="font-semibold text-foreground">{formatCurrency(registrationPricePerYear * years, currency)}</span>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Starting checkout..." : "Continue to Payment"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
