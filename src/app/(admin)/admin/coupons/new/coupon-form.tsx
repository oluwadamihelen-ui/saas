"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCoupon, type CouponFormState } from "../actions";

const initial: CouponFormState = { status: "idle" };

export function CouponForm() {
  const [state, formAction, isPending] = useActionState(createCoupon, initial);
  const [type, setType] = React.useState<"PERCENT" | "FIXED">("PERCENT");

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Coupon code</Label>
            <Input id="code" name="code" placeholder="WELCOME10" required className="uppercase" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type">Discount type</Label>
              <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}>
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="value">{type === "PERCENT" ? "Percent off" : "Amount off"}</Label>
              <Input id="value" name="value" type="number" min="0" step="0.01" max={type === "PERCENT" ? 100 : undefined} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="maxUses">Max uses (optional)</Label>
              <Input id="maxUses" name="maxUses" type="number" min="1" placeholder="Unlimited" />
            </div>
            <div />
            <div className="space-y-1.5">
              <Label htmlFor="startsAt">Starts (optional)</Label>
              <Input id="startsAt" name="startsAt" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Expires (optional)</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Coupon"}
          </Button>
          {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
