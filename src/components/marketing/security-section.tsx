import { Cloud, ShieldCheck, KeyRound, RefreshCw } from "lucide-react";
import { Reveal } from "./reveal";

const POINTS = [
  { title: "Secure cloud infrastructure", description: "Your school's data is hosted on secure cloud infrastructure.", icon: Cloud },
  { title: "Role-based access", description: "Every account only sees what its role is permitted to access.", icon: KeyRound },
  { title: "Protected school data", description: "Student, staff and financial records are kept private to your school.", icon: ShieldCheck },
  { title: "Regular backups", description: "Your school's data is backed up so information is never at risk of loss.", icon: RefreshCw },
];

export function SecuritySection() {
  return (
    <section className="border-y border-border bg-muted-surface/60 py-20 sm:py-28">
      <div className="container-shell">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Security</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Your school&apos;s information deserves protection.
          </h2>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((point, i) => (
            <Reveal key={point.title} delayMs={i * 80}>
              <div className="h-full rounded-2xl border border-border bg-surface p-6 text-center">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <point.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{point.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
