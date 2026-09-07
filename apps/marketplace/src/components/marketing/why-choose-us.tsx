import { Zap, PackageCheck, Settings2, Layers, HeadphonesIcon } from "lucide-react";

const REASONS = [
  { icon: Zap, title: "Fast deployment", description: "Go from purchase to a live application in hours, not weeks." },
  { icon: PackageCheck, title: "Production-ready software", description: "Every application is built and tested for real business use." },
  { icon: Settings2, title: "Managed setup", description: "Our team handles provisioning, DNS, and SSL for you." },
  { icon: Layers, title: "Flexible infrastructure", description: "Bring your own server or use our hosting — your choice." },
  { icon: HeadphonesIcon, title: "Business support", description: "Real people to help with deployments, renewals, and issues." },
];

export function WhyChooseUs() {
  return (
    <section className="border-b border-border bg-background py-20">
      <div className="container-shell">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Why Choose Us</h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {REASONS.map((reason) => (
            <div key={reason.title} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
                <reason.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{reason.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{reason.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
