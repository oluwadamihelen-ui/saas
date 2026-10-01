import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { ListingCard } from "@/components/market/parts";
import { listCategories, searchListings, type SearchParams } from "@/lib/market/listings";
import { LAB_TIMEFRAMES, MARKETS } from "@/lib/lab/schemas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Indicator marketplace", description: "Browse trading indicators and strategies from independent creators. Historical backtests are simulations, not promises." };

const QUICK = [["market", "XAUUSD"], ["market", "BTCUSD"], ["category", "forex"], ["category", "crypto"], ["category", "gold"], ["timeframe", "M15"], ["timeframe", "H1"], ["timeframe", "H4"], ["category", "scalping"], ["category", "swing-trading"], ["category", "trend-following"], ["category", "breakout"]] as const;

export default async function MarketPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params: SearchParams = {
    q: sp.q, market: sp.market, timeframe: sp.timeframe, category: sp.category, price: sp.price === "free" || sp.price === "paid" ? sp.price : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined, minRating: sp.minRating ? Number(sp.minRating) : undefined,
    sort: (["newest", "price_asc", "price_desc", "rating", "reviews"] as const).find((s) => s === sp.sort) ?? "newest",
  };
  const [results, categories] = await Promise.all([searchListings(params), listCategories()]);
  const link = (k: string, v: string | undefined) => { const n = new URLSearchParams(Object.entries(sp).filter(([, x]) => x) as [string, string][]); if (v === undefined || n.get(k) === v) n.delete(k); else n.set(k, v); return `/market?${n}`; };
  const active = (k: string, v: string) => sp[k] === v;
  const sel = "h-10 rounded-lg border border-line bg-bg px-3 text-sm";
  return (
    <>
      <PageHeader title="Indicator marketplace" subtitle="Indicators and strategies from independent creators. Every public backtest shows its full assumptions — and is a historical simulation, not a promise." />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search by indicator or creator name" className="h-10 min-w-56 flex-1 rounded-lg border border-line bg-bg px-3 text-sm" />
        <select name="market" defaultValue={sp.market ?? ""} className={sel}><option value="">Any market</option>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select>
        <select name="timeframe" defaultValue={sp.timeframe ?? ""} className={sel}><option value="">Any timeframe</option>{LAB_TIMEFRAMES.map((m) => <option key={m}>{m}</option>)}</select>
        <select name="category" defaultValue={sp.category ?? ""} className={sel}><option value="">Any category</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <select name="price" defaultValue={sp.price ?? ""} className={sel}><option value="">Free & paid</option><option value="free">Free</option><option value="paid">Paid</option></select>
        <select name="minRating" defaultValue={sp.minRating ?? ""} className={sel}><option value="">Any rating</option><option value="4">4★ & up</option><option value="3">3★ & up</option></select>
        <select name="sort" defaultValue={sp.sort ?? "newest"} className={sel}><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="rating">Rating</option><option value="reviews">Most reviews</option></select>
        <button className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-white">Search</button>
      </form>
      <div className="mb-6 flex flex-wrap gap-2">
        {QUICK.map(([k, v]) => <Link key={k + v} href={link(k, v)} className={cn("rounded-full border px-3 py-1 text-xs", active(k, v) ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg")}>{v.replace("-", " ")}</Link>)}
      </div>
      {results.length === 0 ? <Empty title="No products match" body="Try removing a filter. The marketplace only lists approved products." action={<Link href="/market" className="text-sm text-accent hover:underline">Clear filters</Link>} /> : (
        <>
          <p className="mb-3 text-sm text-muted">{results.length} product{results.length === 1 ? "" : "s"}. Sorting never implies quality — read each listing&apos;s documentation and assumptions.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.map((l) => <ListingCard key={l.id} l={l} />)}</div>
        </>
      )}
    </>
  );
}
