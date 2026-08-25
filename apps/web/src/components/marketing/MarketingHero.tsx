import Link from "next/link";

/** Logged-out hero — headline, CTAs, and a stack of illustrative product-preview cards. */
export function MarketingHero() {
  return (
    <section className="relative overflow-hidden bg-rewards-hero px-4 pb-20 pt-16 md:px-8 md:pb-28 md:pt-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl text-center lg:text-left">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-rewards-ink sm:text-5xl md:text-6xl">
            Turn Your Ideas Into a{" "}
            <span className="relative inline-flex items-center rounded-full bg-rewards-orange-light/60 px-3 align-middle text-rewards-orange2">
              Movie
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base text-rewards-muted md:text-lg lg:mx-0">
            Describe a story or adapt one you already have — Cinerra's AI builds the cast, cinematography, and
            score, end to end.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href="/signup" className="rewards-btn-primary">
              Start Creating Today
            </Link>
            <Link href="/discover" className="rewards-btn-outline">
              Explore Movies
            </Link>
          </div>
        </div>

        <div className="relative hidden h-80 w-72 shrink-0 lg:block">
          <PreviewCard
            className="absolute left-0 top-6 -rotate-6"
            eyebrow="New Story"
            title="The Last Horizon"
            tint="from-rewards-orange-light/70 to-white"
          >
            <div className="mt-5 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rewards-orange text-white shadow-rewards-glow">
                <PlayIcon />
              </span>
            </div>
            <p className="mt-4 text-center text-[11px] text-rewards-muted">Sci-Fi · Feature Film</p>
          </PreviewCard>

          <PreviewCard className="absolute left-16 top-24 rotate-2" eyebrow="Studio" title="Team Project">
            <div className="mt-4 space-y-2">
              <div className="h-2 w-full rounded-full bg-rewards-cream2" />
              <div className="h-2 w-4/5 rounded-full bg-rewards-cream2" />
              <div className="flex -space-x-2 pt-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-6 w-6 rounded-full border-2 border-white bg-rewards-orange-light" />
                ))}
              </div>
            </div>
          </PreviewCard>

          <PreviewCard className="absolute left-32 top-0 rotate-12" eyebrow="Earnings" title="Wallet">
            <p className="mt-3 text-2xl font-extrabold text-rewards-ink">1,240 <span className="text-xs font-medium text-rewards-muted">coins</span></p>
            <p className="mt-1 text-[11px] font-medium text-rewards-green">from published movies</p>
          </PreviewCard>
        </div>
      </div>
    </section>
  );
}

function PreviewCard({
  className = "",
  eyebrow,
  title,
  tint,
  children,
}: {
  className?: string;
  eyebrow: string;
  title: string;
  tint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rewards-card w-52 p-4 ${className}`}>
      {tint && <div aria-hidden className={`-m-4 mb-3 h-16 rounded-t-2xl bg-gradient-to-br ${tint}`} />}
      <span className="rewards-tag">{eyebrow}</span>
      <p className="mt-2 text-sm font-bold text-rewards-ink">{title}</p>
      {children}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
