"use client";
import { useActionState, useState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { purchaseAction, reportAction, setTvUsernameAction, submitReviewAction } from "@/actions/market";
import type { ActionState } from "@/lib/validation";
import { ngnShort, priceLabel, usdShort, type PricingModel } from "@/lib/market/format";

type Act = (s: ActionState, fd: FormData) => Promise<ActionState>;
function Msg({ s }: { s: ActionState }) {
  return (<>{s.error && <p role="alert" className="text-sm text-down">{s.error}</p>}{s.message && <p role="status" className="text-sm text-up">{s.message}</p>}</>);
}

export function BuyBox({ listingId, model, cents, ngnRate, tradingViewAccess, loggedIn, callbackUrl, label }: { listingId: string; model: PricingModel; cents: number; ngnRate: number; tradingViewAccess: boolean; loggedIn: boolean; callbackUrl: string; label: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(purchaseAction as Act, {});
  const [cur, setCur] = useState<"USD" | "NGN">("USD");
  if (!loggedIn) {
    return <a href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-white hover:bg-blue-500">{model === "FREE" ? "Sign in to get it free" : "Sign in to buy"}</a>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="currency" value={cur} />
      {model !== "FREE" && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(["USD", "NGN"] as const).map((c) => <button key={c} type="button" aria-pressed={cur === c} onClick={() => setCur(c)} className={`rounded-lg border px-3 py-2 ${cur === c ? "border-accent bg-accent-soft" : "border-line text-muted"}`}>{c === "USD" ? usdShort(cents) : ngnShort(cents, ngnRate)}</button>)}
        </div>
      )}
      {tradingViewAccess && <Field label="Your TradingView username" hint="The creator grants invite-only access to this username. You can add it later in My Indicators."><Input name="tradingViewUsername" placeholder="e.g. goldtrader_ng" /></Field>}
      <Msg s={state} />
      <Button className="w-full" size="lg" disabled={pending}>{pending ? "Please wait…" : label}</Button>
      {model !== "FREE" && <p className="text-[11px] text-muted">{priceLabel(model, cents)}. Payment is handled by a third-party processor. See the Refund Policy.</p>}
    </form>
  );
}

export function ReviewForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitReviewAction as Act, {});
  const [rating, setRating] = useState(5);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} onClick={() => setRating(n)} className={`h-9 w-9 rounded-lg border text-sm ${rating >= n ? "border-warn bg-warn-soft text-warn" : "border-line text-muted"}`}>{n}</button>)}</div>
      <Input name="title" placeholder="Headline (optional)" maxLength={100} />
      <Textarea name="body" placeholder="What was your experience? Describe how you used it — please don't include claims about profits." maxLength={2000} />
      <Msg s={state} />
      <Button disabled={pending} size="sm">{pending ? "Posting…" : "Post review"}</Button>
    </form>
  );
}

export function ReportForm({ listingId, reviewId }: { listingId?: string; reviewId?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reportAction as Act, {});
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted underline hover:text-fg">Report</button>;
  return (
    <form action={action} className="mt-2 space-y-2 rounded-lg border border-line bg-bg/60 p-3">
      <input type="hidden" name="listingId" value={listingId ?? ""} /><input type="hidden" name="reviewId" value={reviewId ?? ""} />
      <Select name="reason" defaultValue="Misleading claims"><option>Misleading claims</option><option>Copied or stolen work</option><option>Abusive or fake review</option><option>Scam or fraud</option><option>Other</option></Select>
      <Textarea name="details" placeholder="Details (optional)" maxLength={1000} />
      <Msg s={state} />
      <div className="flex gap-2"><Button size="sm" disabled={pending}>Send report</Button><Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button></div>
    </form>
  );
}

export function TvUsernameForm({ listingId, current }: { listingId: string; current: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setTvUsernameAction as Act, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <Input name="username" defaultValue={current ?? ""} placeholder="TradingView username" className="h-9 w-48" />
      <Button size="sm" variant="secondary" disabled={pending}>Save</Button>
      <Msg s={state} />
    </form>
  );
}
