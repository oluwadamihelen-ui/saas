/** Shared building blocks for the /terms and /privacy pages. */

export function LegalDisclaimer() {
  return (
    <div className="mt-6 rounded-xl border border-cinerra-gold/40 bg-cinerra-gold/10 px-4 py-3 text-sm text-cinerra-text">
      This is a template draft, not legal advice — it hasn&rsquo;t been reviewed by a lawyer. Have qualified counsel review
      and adapt it to your jurisdiction and business before relying on it for a real launch.
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-cinerra-text">{title}</h2>
      <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-cinerra-muted [&_a]:text-cinerra-accent [&_li]:ml-1">
        {children}
      </div>
    </section>
  );
}
