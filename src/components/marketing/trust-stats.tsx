import { Layers, ClipboardCheck, Clock, Cloud } from "lucide-react";
import { Reveal } from "./reveal";

const STATS = [
  { value: "1", label: "Platform", icon: Layers },
  { value: "8+", label: "Core school operations", icon: ClipboardCheck },
  { value: "24/7", label: "Access", icon: Clock },
  { value: "100%", label: "Cloud based", icon: Cloud },
];

export function TrustStats() {
  return (
    <section className="border-y border-border bg-muted-surface/60">
      <div className="container-shell py-12 sm:py-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Why schools choose Schoolum</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Built to simplify school management.
          </h2>
        </Reveal>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delayMs={i * 80} className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-accent shadow-sm">
                <stat.icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-sm text-muted">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
