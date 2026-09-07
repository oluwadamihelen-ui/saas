const TESTIMONIALS = [
  {
    quote:
      "We launched our restaurant ordering system in three days instead of three months. The deployment tracking gave us total visibility.",
    name: "Amaka Obi",
    role: "Founder, Plateful",
  },
  {
    quote: "Buying a ready-made CRM and having it deployed to our own server saved us a full engineering quarter.",
    name: "David Chen",
    role: "COO, Northgate Realty",
  },
  {
    quote: "Support has been excellent — renewals, SSL, and monitoring are all handled without us lifting a finger.",
    name: "Grace Adeyemi",
    role: "Operations Lead, Clinicly",
  },
];

export function Testimonials() {
  return (
    <section className="border-b border-border bg-surface py-20">
      <div className="container-shell">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Trusted by growing businesses</h2>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-lg border border-border bg-background p-6">
              <blockquote className="flex-1 text-sm text-foreground">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-foreground">{t.name}</span>
                <span className="text-muted"> — {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
