import { Layers, Smartphone, Sparkles, Building2 } from "lucide-react";
import { Reveal } from "./reveal";

const BENEFITS = [
  {
    title: "All-in-One Platform",
    description: "Stop switching between spreadsheets and multiple applications.",
    icon: Layers,
  },
  {
    title: "Easy to Use",
    description: "Designed for school administrators, not technical experts.",
    icon: Sparkles,
  },
  {
    title: "Access Anywhere",
    description: "Manage your school from your computer, tablet or phone.",
    icon: Smartphone,
  },
  {
    title: "Built to Scale",
    description: "From small schools to growing institutions.",
    icon: Building2,
  },
];

export function WhySchoolum() {
  return (
    <section id="why-schoolum" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-shell">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-wide text-accent">Why Schoolum</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Built for the way modern schools work.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
              Schoolum replaces disconnected spreadsheets and manual processes with one intelligent platform your
              whole school team can rely on — from the front office to the classroom.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {BENEFITS.map((benefit, i) => (
              <Reveal key={benefit.title} delayMs={i * 80}>
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <benefit.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{benefit.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{benefit.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
