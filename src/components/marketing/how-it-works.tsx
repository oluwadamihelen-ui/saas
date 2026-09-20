import { Reveal } from "./reveal";

const STEPS = [
  {
    number: "01",
    title: "Create Your School",
    description: "Set up your school profile — name, academic terms and structure — in a guided setup wizard.",
  },
  {
    number: "02",
    title: "Add Your People",
    description: "Add students, teachers, staff and administrators, and assign the right access to each role.",
  },
  {
    number: "03",
    title: "Start Managing",
    description: "Begin managing academics, attendance, fees, communication and reporting — all in one place.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-shell">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Get your school running in minutes.
          </h2>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delayMs={i * 100} className="relative">
              <div className="flex flex-col items-start">
                <span className="text-4xl font-semibold tracking-tight text-accent/25">{step.number}</span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="absolute right-0 top-6 hidden h-px w-6 -translate-y-1/2 translate-x-full bg-border sm:block" />
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
