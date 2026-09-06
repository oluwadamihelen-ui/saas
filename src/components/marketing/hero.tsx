import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="border-b border-border bg-surface">
      <div className="container-shell grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Trusted software, managed infrastructure
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Ready-to-Launch Software for Modern Businesses.
          </h1>
          <p className="max-w-lg text-lg text-muted">
            Buy, customize, deploy and manage powerful web applications without the cost and complexity of building
            everything from scratch.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/apps">
                Explore Applications <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/contact">Build My Solution</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-muted">
            {["Production-ready code", "Managed deployment", "Domains & hosting included"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="rounded-xl border border-border bg-background p-2 shadow-xl">
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="mb-4 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              </div>
              <div className="space-y-3">
                {[
                  { label: "Application prepared", done: true },
                  { label: "Server connected", done: true },
                  { label: "Application installed", done: true },
                  { label: "DNS configuration", done: false, active: true },
                  { label: "SSL certificate", done: false },
                  { label: "Live", done: false },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        step.done
                          ? "flex h-5 w-5 items-center justify-center rounded-full bg-success text-white text-[10px]"
                          : step.active
                            ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px]"
                            : "flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px]"
                      }
                    >
                      {step.done ? "✓" : step.active ? "●" : ""}
                    </span>
                    <span className={step.done || step.active ? "text-foreground" : "text-muted"}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
