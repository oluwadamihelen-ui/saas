"use client";
import { useActionState } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { saveSettingsAction } from "@/actions/admin";
import type { MarketSettings } from "@/lib/market/settings-defaults";
import type { ActionState } from "@/lib/validation";

type Act = (s: ActionState, fd: FormData) => Promise<ActionState>;
const d = (c: number) => String(c / 100);

export function SettingsForm({ s }: { s: MarketSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettingsAction as Act, {});
  return (
    <form action={action}>
      <Card className="space-y-6 p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Commission (%)" hint="Platform share of each sale, after tax and (if the creator bears it) processing fees."><Input name="commissionPercent" inputMode="decimal" defaultValue={s.commissionPercent} /></Field>
          <Field label="Processing fee (%)" hint="Estimate of your payment provider's percentage fee."><Input name="processingFeePercent" inputMode="decimal" defaultValue={s.processingFeePercent} /></Field>
          <Field label="Processing fee fixed (USD)"><Input name="processingFeeFixed" inputMode="decimal" defaultValue={d(s.processingFeeFixedCents)} /></Field>
          <Field label="Tax included in prices (%)" hint="Prices are tax-inclusive; this share is set aside before commission."><Input name="taxPercent" inputMode="decimal" defaultValue={s.taxPercent} /></Field>
          <Field label="Who bears processing fees"><Select name="feeBearer" defaultValue={s.feeBearer}><option value="creator">Creator (deducted from their share)</option><option value="platform">Platform (paid from commission)</option></Select></Field>
          <Field label="Holdback (days)" hint="Earnings stay 'pending' this long so refunds can be handled."><Input name="holdbackDays" inputMode="numeric" defaultValue={s.holdbackDays} /></Field>
          <Field label="Minimum payout (USD)"><Input name="minPayout" inputMode="decimal" defaultValue={d(s.minPayoutUsdCents)} /></Field>
          <Field label="NGN per USD" hint="Used to show and charge Naira prices."><Input name="ngnPerUsd" inputMode="decimal" defaultValue={s.ngnPerUsd} /></Field>
          <Field label="Min trades for paid evidence"><Input name="minEvidenceTrades" inputMode="numeric" defaultValue={s.minEvidenceTrades} /></Field>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Creator price limits (USD)</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {([["ot", "One-time", s.priceLimits.ONE_TIME], ["m", "Monthly", s.priceLimits.MONTHLY], ["y", "Yearly", s.priceLimits.YEARLY]] as const).map(([k, label, v]) => (
              <div key={k} className="grid grid-cols-2 gap-2"><Field label={`${label} min`}><Input name={`${k}_min`} inputMode="decimal" defaultValue={d(v.minCents)} /></Field><Field label={`${label} max`}><Input name={`${k}_max`} inputMode="decimal" defaultValue={d(v.maxCents)} /></Field></div>
            ))}
          </div>
        </div>
        {state.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
        {state.message && <p role="status" className="text-sm text-up">{state.message}</p>}
        <Button disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </Card>
    </form>
  );
}
