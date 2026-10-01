import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Calculator as CalcIcon, Gauge, ShieldCheck } from "lucide-react";
import { Calculator } from "@/components/calc/calculator";
import { PricingCards } from "@/components/pricing";
import { Card, Disclaimer, LinkButton, Logo } from "@/components/ui";

const PROBLEMS = [
  ["Oversized positions", "One trade risks 5–10% of the account because the lot size was a guess."],
  ["Guessing lot size", "Gold, Bitcoin and forex all size differently, and brokers differ."],
  ["Moving stop losses", "The plan says 1%. The trade ends up costing 4%."],
  ["No record", "Without a journal you can't see what you repeat — good or bad."],
  ["Revenge trading", "A loss, then a bigger trade, then another loss."],
  ["Invisible risk", "No view of how much you have at risk today or this week."],
];

const FAQ = [
  ["Does RiskPilot tell me what to buy or sell?", "No. RiskPilot never gives trading signals or advice. It calculates risk from the numbers you enter and records what you did."],
  ["Is the position size always correct?", "It is only as accurate as the contract specification you use. Brokers differ, so values are marked “Estimated” until you confirm them with your broker. Always verify contract specifications with your broker."],
  ["Does it connect to my broker or MT5?", "Not yet. You enter trades yourself. Nothing here can place or block trades."],
  ["Which currencies and markets are supported?", "Accounts in USD, NGN, EUR and GBP. Presets for XAUUSD, BTCUSD, forex pairs and indices — and you can edit every specification."],
  ["Can it stop me from over-trading?", "It shows your daily and weekly limits and tells you when you've reached your own rules. The decision to stop stays with you."],
  ["What does Pro add?", "Unlimited trades, advanced analytics, multiple accounts, screenshots, CSV export and TradingView tools. It doesn't promise or guarantee any trading result."],
];

export default function Landing() {
  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#how" className="hover:text-fg">How it works</a><a href="#calculator" className="hover:text-fg">Calculator</a><a href="#lab" className="hover:text-fg">Indicator Lab</a><Link href="/market" className="hover:text-fg">Marketplace</Link><a href="#pricing" className="hover:text-fg">Pricing</a><a href="#faq" className="hover:text-fg">FAQ</a>
          </nav>
          <div className="flex items-center gap-2"><LinkButton href="/login" variant="ghost" size="sm">Log in</LinkButton><LinkButton href="/register" size="sm">Sign up</LinkButton></div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.18),transparent_65%)]" />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 text-center md:pt-24">
          <p className="mb-4 inline-block rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">Risk management + journaling for MT5 &amp; TradingView traders</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Know your risk before you enter the trade.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">Calculate position size, journal every trade, and see exactly how your trading risk is affecting your account.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="#calculator" size="lg">Calculate My Risk <ArrowRight size={18} /></LinkButton>
            <LinkButton href="/register" size="lg" variant="secondary">Start Journaling</LinkButton>
          </div>
          <p className="mt-4 text-xs text-muted">Free to start · USD &amp; NGN · Not a signal service</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-semibold md:text-3xl">Most accounts are lost to risk, not entries.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map(([t, b]) => <Card key={t} className="p-5"><h3 className="font-medium">{t}</h3><p className="mt-1.5 text-sm text-muted">{b}</p></Card>)}
        </div>
      </section>

      <section id="how" className="border-y border-line bg-surface/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-semibold md:text-3xl">Risk first. Every trade.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[["1 · Calculate", "Get your lot size from entry, stop and risk %."], ["2 · Check", "See your limits and a pre-trade checklist."], ["3 · Trade", "Place the trade on your own platform."], ["4 · Journal", "Record the result, reasons and emotions."], ["5 · Analyze", "See how your habits affect your results."]].map(([t, b]) => <Card key={t} className="p-4"><h3 className="font-semibold text-accent">{t}</h3><p className="mt-1.5 text-sm text-muted">{b}</p></Card>)}
          </div>
        </div>
      </section>

      <section id="calculator" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16">
        <h2 className="text-2xl font-semibold md:text-3xl">How much should I risk?</h2>
        <p className="mb-8 mt-2 text-muted">Try it now — no sign-up. Gold example pre-filled.</p>
        <Calculator mode="size" currency="USD" initial={{ balance: 1000, riskPercent: 1, entry: "2650", stop: "2640", tp: "2680" }} />
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 md:grid-cols-2">
        {[
          [BookOpen, "A journal that builds accountability", "Log entry, stop, size, setup, session, emotions, notes and screenshots. Edit anytime."],
          [BarChart3, "Analytics that describe your habits", "Win rate, profit factor, R multiples, drawdown — split by instrument, session, weekday and risk size. History only, never advice."],
          [ShieldCheck, "Guardrails for your own rules", "Set a daily loss limit and trade cap. See today's risk used and remaining. When you hit your limit: “Your rule says to stop trading for today.”"],
          [Gauge, "TradingView risk tools", "A Pine Script indicator that draws entry, stop, target and zones — and shows risk amount, R:R and position size. No buy/sell signals."],
        ].map(([Icon, t, b]) => { const I = Icon as typeof CalcIcon; return <Card key={t as string} className="flex gap-4 p-6"><I className="mt-1 shrink-0 text-accent" size={22} /><div><h3 className="font-semibold">{t as string}</h3><p className="mt-1.5 text-sm text-muted">{b as string}</p></div></Card>; })}
      </section>

      <section id="lab" className="border-y border-line bg-surface/40 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold md:text-3xl">Indicator Lab: test your own indicator honestly.</h2>
            <p className="mt-3 text-muted">Paste your Pine Script, document its inputs, then turn it into an explicit strategy: you define the entries, exits, stop, target and risk. Test it on your own candle data with spread, slippage and commission, split results by session, run parameter tests, and check an out-of-sample period.</p>
            <ul className="mt-4 space-y-2 text-sm text-muted"><li>• An indicator is not a strategy — nothing trades until you write the rules</li><li>• Every result is labelled a historical simulation, with all assumptions shown</li><li>• Parameter tests never crown a &ldquo;best&rdquo; setting, and warn about overfitting</li></ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold md:text-3xl">A marketplace with receipts.</h2>
            <p className="mt-3 text-muted">Creators can sell access to indicators without handing over their source code. Buyers see the backtest period, costs, sample type and data source — and verified reviews. Claims like &ldquo;guaranteed profits&rdquo; are not allowed.</p>
            <div className="mt-4 flex flex-wrap gap-3"><LinkButton href="/market" variant="secondary">Browse the marketplace</LinkButton><LinkButton href="/creator" variant="ghost">Become a creator</LinkButton></div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-4 pb-16">
        <h2 className="text-2xl font-semibold md:text-3xl">Simple pricing</h2>
        <p className="mb-8 mt-2 text-muted">Start free. Pay in USD or Naira when you need more.</p>
        <PricingCards mode="public" />
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 pb-16">
        <h2 className="mb-6 text-2xl font-semibold md:text-3xl">Questions</h2>
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {FAQ.map(([q, a]) => <details key={q} className="group p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-muted">{a}</p></details>)}
        </div>
      </section>

      <footer className="border-t border-line py-10">
        <div className="mx-auto max-w-6xl space-y-4 px-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><Logo /><div className="flex flex-wrap gap-4 text-sm text-muted"><Link href="/market">Marketplace</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/risk-disclosure">Risk Disclosure</Link><Link href="/legal/seller-terms">Seller Terms</Link><Link href="/legal/refund-policy">Refund Policy</Link><Link href="/login">Log in</Link><Link href="/register">Sign up</Link></div></div>
          <Disclaimer />
        </div>
      </footer>
    </div>
  );
}
