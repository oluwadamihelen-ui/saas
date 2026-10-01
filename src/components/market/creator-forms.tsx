"use client";
import { useActionState, useState } from "react";
import { Button, Card, CardHeader, Field, Hint, Input, Select, Textarea } from "@/components/ui";
import { attachEvidenceAction, saveCreatorProfileAction, setPayoutMethodAction, updateListingAction, uploadScreenshotAction } from "@/actions/market";
import type { ActionState } from "@/lib/validation";
import { validatePrice } from "@/lib/market/licensing";
import type { MarketSettings } from "@/lib/market/settings-defaults";

type Act = (s: ActionState, fd: FormData) => Promise<ActionState>;
function Msg({ s }: { s: ActionState }) {
  return (<>{s.error && <p role="alert" className="rounded-lg bg-down-soft px-3 py-2 text-sm text-down">{s.error}</p>}{s.message && <p role="status" className="rounded-lg bg-up-soft px-3 py-2 text-sm text-up">{s.message}</p>}</>);
}

export function CreatorProfileForm({ initial, next }: { initial?: { displayName: string; bio: string; website: string | null }; next?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCreatorProfileAction as Act, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Display name" hint="Shown on your listings."><Input name="displayName" defaultValue={initial?.displayName} required /></Field>
      <Field label="About you"><Textarea name="bio" defaultValue={initial?.bio} placeholder="Your background and what you build. Please don't include promises of results." maxLength={1000} /></Field>
      <Field label="Website (optional)"><Input name="website" defaultValue={initial?.website ?? ""} placeholder="https://" /></Field>
      <Msg s={state} />
      <Button disabled={pending}>{pending ? "Saving…" : initial ? "Save profile" : "Create creator profile"}</Button>
    </form>
  );
}

export function PayoutMethodForm({ hint }: { hint: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setPayoutMethodAction as Act, {});
  return (
    <form action={action} className="space-y-2">
      <Field label="Payout details" hint="Bank name, account number and account name. Stored encrypted; only verification staff can read it. Changing it requires re-verification."><Input name="method" placeholder={hint ? `Saved (${hint}) — enter new details to replace` : "e.g. GTBank 0123456789 Ada Obi"} autoComplete="off" /></Field>
      <Msg s={state} />
      <Button size="sm" variant="secondary" disabled={pending}>Save payout details</Button>
    </form>
  );
}

export interface ListingEditorProps {
  l: { id: string; title: string; tagline: string; description: string; categories: string[]; features: string[]; documentation: string; methodology: string; dataSourceNote: string; demoVideoUrl: string | null; pricingModel: string; priceUsdCents: number; sourceIncluded: boolean; updatePolicy: string; tradingViewAccess: boolean; allowBuyerBacktest: boolean; strategyId: string | null };
  categories: { slug: string; name: string }[];
  strategies: { id: string; name: string }[];
  settings: Pick<MarketSettings, "commissionPercent" | "priceLimits" | "holdbackDays" | "feeBearer" | "processingFeePercent">;
}

export function ListingEditor({ l, categories, strategies, settings }: ListingEditorProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateListingAction as Act, {});
  const [model, setModel] = useState(l.pricingModel);
  const [price, setPrice] = useState(String(l.priceUsdCents / 100));
  const [src, setSrc] = useState(l.sourceIncluded);
  const [bt, setBt] = useState(l.allowBuyerBacktest);
  const cents = Math.round(Number(price) * 100);
  const priceErr = model === "FREE" ? null : validatePrice(model as "ONE_TIME", Number.isFinite(cents) ? cents : 0, settings.priceLimits);
  const earn = model === "FREE" || priceErr ? null : Math.round(cents * (1 - settings.commissionPercent / 100));
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={l.id} />
      <Card className="p-4 md:p-5"><div className="grid gap-4">
        <Field label="Title"><Input name="title" defaultValue={l.title} required maxLength={80} /></Field>
        <Field label="Tagline" hint="One line. Describe what it does — not promised results."><Input name="tagline" defaultValue={l.tagline} maxLength={140} /></Field>
        <Field label="Description"><Textarea name="description" defaultValue={l.description} rows={6} maxLength={5000} /></Field>
        <Field label="Key features" hint="One per line (up to 12)."><Textarea name="features" defaultValue={l.features.join("\n")} rows={5} /></Field>
        <div><span className="mb-1.5 block text-xs font-medium text-muted">Categories (up to 5)</span><div className="flex flex-wrap gap-2">{categories.map((c) => <label key={c.slug} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft"><input type="checkbox" name="categories" value={c.slug} defaultChecked={l.categories.includes(c.slug)} className="accent-blue-500" />{c.name}</label>)}</div></div>
        <Field label="Documentation" hint="How to install and use it; what every input does; known limitations."><Textarea name="documentation" defaultValue={l.documentation} rows={8} maxLength={20000} /></Field>
        <Field label="Demo video link (optional)" hint="https link from YouTube, Vimeo or Loom."><Input name="demoVideoUrl" defaultValue={l.demoVideoUrl ?? ""} placeholder="https://youtu.be/…" /></Field>
      </div></Card>

      <Card className="p-4 md:p-5">
        <CardHeader title="Backtest methodology & data (shown publicly)" hint="Required for paid products. Buyers see this next to every backtest you publish." />
        <div className="grid gap-4 pt-4">
          <Field label="Methodology"><Textarea name="methodology" defaultValue={l.methodology} rows={4} placeholder="Rules tested, how parameters were chosen, in-sample vs out-of-sample split, what was excluded…" /></Field>
          <Field label="Data source"><Input name="dataSourceNote" defaultValue={l.dataSourceNote} placeholder="e.g. Broker export, XAUUSD H1, 2023–2026" /></Field>
        </div>
      </Card>

      <Card className="p-4 md:p-5">
        <h3 className="mb-3 text-sm font-semibold">Pricing & licensing</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Model"><Select name="pricingModel" value={model} onChange={(e) => setModel(e.target.value)}><option value="FREE">Free</option><option value="ONE_TIME">One-time purchase</option><option value="MONTHLY">Monthly subscription</option><option value="YEARLY">Yearly subscription</option></Select></Field>
          <Field label="Price (USD)" hint={model === "FREE" ? "" : `Allowed: $${(settings.priceLimits[model as "ONE_TIME"].minCents / 100).toFixed(0)} – $${(settings.priceLimits[model as "ONE_TIME"].maxCents / 100).toFixed(0)}`}><Input name="priceUsd" inputMode="decimal" value={model === "FREE" ? "0" : price} onChange={(e) => setPrice(e.target.value)} disabled={model === "FREE"} /></Field>
          <Field label="Updates for one-time buyers" hint="Subscribers always get every update while subscribed."><Select name="updatePolicy" defaultValue={l.updatePolicy}><option value="ALL_UPDATES">All future updates</option><option value="SAME_MAJOR">Same major version (e.g. 1.x)</option><option value="NO_UPDATES">Version at purchase only</option></Select></Field>
        </div>
        {priceErr && <p className="mt-2 text-sm text-down">{priceErr}</p>}
        {earn !== null && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Platform commission is currently <b className="text-fg">{settings.commissionPercent}%</b> (set by RiskPilot; payment-processing fees of about {settings.processingFeePercent}% are {settings.feeBearer === "creator" ? "deducted from your share" : "paid by the platform"}). Earnings are held {settings.holdbackDays} days before they become available for payout. On this price you&apos;d earn roughly <b className="text-fg">${(earn / 100).toFixed(2)}</b> before fees.</p>}
        <div className="mt-5 space-y-3 text-sm">
          <label className="flex items-start gap-3"><input type="checkbox" name="sourceIncluded" checked={src} onChange={(e) => setSrc(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-500" /><span><b>Include source code with purchase</b> <Hint text="Default is OFF: buyers get access without your Pine Script. Turn this on only if you intend to sell the source." /><span className="block text-xs text-muted">{src ? "Warning: buyers with an active license can download your Pine Script source. They could share it." : "Protected (default): your source code is never shown or sent to buyers."}</span></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" name="tradingViewAccess" defaultChecked={l.tradingViewAccess} className="mt-1 h-4 w-4 accent-blue-500" /><span><b>Deliver via TradingView invite-only access</b><span className="block text-xs text-muted">Buyers give their TradingView username; you grant access in TradingView and mark it done in your dashboard.</span></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" name="allowBuyerBacktest" checked={bt} onChange={(e) => setBt(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-500" /><span><b>Let buyers test a strategy in the Lab</b><span className="block text-xs text-muted">Buyers run it on their own data and see results only — never your rules.</span></span></label>
          {bt && <Field label="Strategy buyers can test"><Select name="strategyId" defaultValue={l.strategyId ?? ""}><option value="">Choose…</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
        </div>
      </Card>
      <Msg s={state} />
      <Button size="lg" disabled={pending}>{pending ? "Saving…" : "Save listing"}</Button>
    </form>
  );
}

export function ScreenshotForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadScreenshotAction as Act, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <Field label="Add screenshot (PNG/JPEG/WebP, ≤5 MB)"><Input type="file" name="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-2" /></Field>
      <Field label="Caption"><Input name="caption" placeholder="optional" /></Field>
      <Button size="sm" variant="secondary" disabled={pending}>Upload</Button>
      <div className="w-full"><Msg s={state} /></div>
    </form>
  );
}

export function EvidenceForm({ id, runs }: { id: string; runs: { id: string; label: string; sampleType: string; tradeCount: number; strategy: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(attachEvidenceAction as Act, {});
  if (!runs.length) return <p className="text-sm text-muted">No eligible backtests. Run one on your own (non-synthetic) candle data in the Indicator Lab.</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Select name="runId">{runs.map((r) => <option key={r.id} value={r.id}>{r.strategy} · {r.label || "backtest"} · {r.sampleType === "OUT_OF_SAMPLE" ? "out-of-sample" : r.sampleType === "IN_SAMPLE" ? "in-sample" : "full period"} · {r.tradeCount} trades</option>)}</Select>
      <Input name="note" placeholder="Short note for buyers (optional)" />
      <Msg s={state} />
      <Button size="sm" variant="secondary" disabled={pending}>Show this backtest publicly</Button>
    </form>
  );
}
