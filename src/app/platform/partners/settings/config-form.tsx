"use client";

import { useActionState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { updatePartnerCommissionConfigAction, type PlatformFormState } from "../actions";

const initialState: PlatformFormState = { status: "idle" };

export function CommissionConfigForm({
  config,
}: {
  config: {
    buyCommissionRateBps: number;
    rentCommissionRateBps: number;
    buyCommissionPolicy: "RECURRING" | "FIRST_PAYMENT_ONLY";
    rentCommissionPolicy: "RECURRING" | "FIRST_PAYMENT_ONLY";
    holdDays: number;
    attributionWindowDays: number;
    minimumWithdrawalMinor: number;
  };
}) {
  const [state, formAction, isPending] = useActionState(updatePartnerCommissionConfigAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="buyCommissionRatePercent">BUY commission rate (%)</Label>
          <Input
            id="buyCommissionRatePercent"
            name="buyCommissionRatePercent"
            type="number"
            step="0.1"
            min="0"
            max="100"
            required
            defaultValue={config.buyCommissionRateBps / 100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rentCommissionRatePercent">RENT commission rate (%)</Label>
          <Input
            id="rentCommissionRatePercent"
            name="rentCommissionRatePercent"
            type="number"
            step="0.1"
            min="0"
            max="100"
            required
            defaultValue={config.rentCommissionRateBps / 100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="buyCommissionPolicy">BUY commission policy</Label>
          <Select id="buyCommissionPolicy" name="buyCommissionPolicy" defaultValue={config.buyCommissionPolicy}>
            <option value="RECURRING">Recurring (every confirmed installment)</option>
            <option value="FIRST_PAYMENT_ONLY">First payment only</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rentCommissionPolicy">RENT commission policy</Label>
          <Select id="rentCommissionPolicy" name="rentCommissionPolicy" defaultValue={config.rentCommissionPolicy}>
            <option value="RECURRING">Recurring (every confirmed renewal)</option>
            <option value="FIRST_PAYMENT_ONLY">First payment only</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="holdDays">Hold period (days)</Label>
          <Input id="holdDays" name="holdDays" type="number" min="0" required defaultValue={config.holdDays} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attributionWindowDays">Attribution window (days)</Label>
          <Input id="attributionWindowDays" name="attributionWindowDays" type="number" min="1" required defaultValue={config.attributionWindowDays} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minimumWithdrawal">Minimum withdrawal (NGN)</Label>
          <Input
            id="minimumWithdrawal"
            name="minimumWithdrawal"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={config.minimumWithdrawalMinor / 100}
          />
        </div>
      </div>
      <p className="text-xs text-muted">
        Changes only affect new commercial agreements, referrals, and withdrawal requests going forward — existing ones already snapshotted their own
        rate and never change retroactively.
      </p>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save settings"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
