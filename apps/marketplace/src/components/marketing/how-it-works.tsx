const STEPS = [
  { title: "Choose an application", description: "Browse the marketplace and preview a live demo before you buy." },
  { title: "Purchase your software", description: "Pick a license, installation, and any customization you need." },
  { title: "Choose your deployment", description: "Use your own server, our managed hosting, or request a fully managed setup." },
  { title: "Connect your domain", description: "Register a new domain or point an existing one — we handle the DNS." },
  { title: "Go live", description: "We provision, install, secure with SSL, and hand you a working application." },
];

export function HowItWorks() {
  return (
    <section className="border-b border-border bg-background py-20">
      <div className="container-shell">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">How It Works</h2>
          <p className="mt-3 text-muted">From browsing to a live, production application in five steps.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative rounded-lg border border-border bg-surface p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {i + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
