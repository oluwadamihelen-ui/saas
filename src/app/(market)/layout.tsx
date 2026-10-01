import Link from "next/link";
import { LinkButton, Logo } from "@/components/ui";
import { getViewer } from "@/lib/session";

export default async function MarketLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/"><Logo /></Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/market" className="rounded-lg px-3 py-1.5 text-muted hover:text-fg">Marketplace</Link>
            {viewer && <Link href="/library" className="hidden rounded-lg px-3 py-1.5 text-muted hover:text-fg sm:block">My Indicators</Link>}
            {viewer ? <LinkButton href="/dashboard" size="sm" variant="secondary">Open app</LinkButton> : <><LinkButton href="/login" size="sm" variant="ghost">Log in</LinkButton><LinkButton href="/register" size="sm">Sign up</LinkButton></>}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-6xl space-y-3 px-4 text-xs text-muted">
          <p>RiskPilot is a technology and marketplace service. It does not manage funds, execute trades, copy trades or give personalised investment advice. Creators are responsible for their own product descriptions. Backtests are historical simulations and do not predict or guarantee future results. Trading leveraged products involves substantial risk.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">{[["terms", "Terms of Service"], ["privacy", "Privacy Policy"], ["risk-disclosure", "Risk Disclosure"], ["seller-terms", "Marketplace Seller Terms"], ["refund-policy", "Refund Policy"]].map(([s, l]) => <Link key={s} href={`/legal/${s}`} className="hover:text-fg">{l}</Link>)}</p>
        </div>
      </footer>
    </div>
  );
}
