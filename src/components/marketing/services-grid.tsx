import { Rocket, Wrench, Globe, Server, LifeBuoy, ShieldCheck } from "lucide-react";

const SERVICES = [
  { icon: Rocket, title: "Application Deployment", description: "We provision infrastructure and deploy your purchased application end-to-end." },
  { icon: Wrench, title: "Customization", description: "Branding, feature changes, and integrations tailored to your business." },
  { icon: Globe, title: "Domain Registration", description: "Search, register, and manage domains across popular extensions." },
  { icon: Server, title: "Hosting", description: "Reliable managed hosting plans sized for your traffic and storage needs." },
  { icon: ShieldCheck, title: "Maintenance", description: "Ongoing updates, monitoring, and security patches." },
  { icon: LifeBuoy, title: "Support", description: "Responsive support from a team that knows your deployment." },
];

export function ServicesGrid() {
  return (
    <section className="border-b border-border bg-surface py-20">
      <div className="container-shell">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Services</h2>
          <p className="mt-3 text-muted">Everything needed to take software from purchase to production.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <div key={service.title} className="rounded-lg border border-border bg-background p-6">
              <service.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-4 text-sm font-semibold text-foreground">{service.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
