const FAQS = [
  {
    q: "Do I need to know how to code?",
    a: "No. Every application is production-ready. If you want changes, our customization service handles it for you.",
  },
  {
    q: "Can I use my own hosting or server?",
    a: "Yes. During checkout you can choose to deploy to your own server, or use hosting provided through the platform.",
  },
  {
    q: "What happens after I purchase an application?",
    a: "You'll choose a deployment option and, if needed, a domain. We queue a deployment job and keep you updated with a live status timeline.",
  },
  {
    q: "Can I upgrade my application later?",
    a: "Yes. Applications are versioned, and upgrades to newer versions can be requested from your dashboard.",
  },
  {
    q: "Do you handle domains and SSL?",
    a: "Yes. You can register a new domain or connect an existing one, and SSL is configured automatically during deployment.",
  },
];

export function FAQ() {
  return (
    <section className="border-b border-border bg-background py-20">
      <div className="container-shell mx-auto max-w-3xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Frequently Asked Questions</h2>
        <div className="mt-10 divide-y divide-border rounded-lg border border-border bg-surface">
          {FAQS.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground">
                {item.q}
                <span className="ml-4 text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
