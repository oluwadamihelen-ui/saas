const STEPS = [
  {
    label: "Step 1",
    title: "Describe Your Story",
    description: "Start from a spark of an idea, or adapt a script or manuscript you already have.",
    icon: PencilIcon,
  },
  {
    label: "Step 2",
    title: "AI Builds Everything",
    description: "Cast, locations, shots, dialogue, and score are generated automatically, scene by scene.",
    icon: SparkIcon,
  },
  {
    label: "Step 3",
    title: "Publish & Share",
    description: "Export your finished movie, publish it to Discover, and earn from every viewer.",
    icon: RocketIcon,
  },
];

/** Logged-out "how it works" section. */
export function HowItWorks() {
  return (
    <section className="bg-rewards-cream2 px-4 py-20 md:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <span className="rewards-badge">
          <DotIcon /> How it Works <DotIcon />
        </span>
        <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-rewards-ink md:text-5xl">
          From Idea to Finished Film in 3 Steps
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-rewards-muted">
          No crew, no cameras, no budget — just a story and Cinerra's AI production pipeline.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.label} className="rewards-card overflow-hidden text-left">
              <div className="relative flex h-36 items-center justify-center bg-rewards-step">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur">
                  <step.icon />
                </span>
                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 rounded-full bg-rewards-orange px-4 py-1 text-xs font-bold text-white shadow-rewards-glow">
                  {step.label}
                </span>
              </div>
              <div className="px-5 pb-6 pt-7 text-center">
                <h3 className="text-lg font-bold text-rewards-ink">{step.title}</h3>
                <p className="mt-2 text-sm text-rewards-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DotIcon() {
  return <span className="h-1.5 w-1.5 rounded-full bg-white/60" />;
}

function PencilIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v6M12 16v6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M16 12h6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4.5 16.5c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8.8-2.2 0-3s-2.2-.8-3 0z" />
      <path d="M12 15l-3-3c2-4 5.5-9 10-9 0 4.5-5 8-9 10z" />
      <circle cx="15" cy="9" r="1.5" />
    </svg>
  );
}
