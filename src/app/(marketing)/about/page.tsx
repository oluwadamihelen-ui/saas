import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="container-shell py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">About Forgecart</h1>
        <p className="mt-4 text-muted">
          Forgecart is a software marketplace and managed deployment company. We build production-ready web
          applications and help businesses launch them quickly — with deployment, domains, hosting, and support
          handled as one service.
        </p>
        <p className="mt-4 text-muted">
          Instead of maintaining our own data centers, we partner with established domain registrars, hosting
          providers, and infrastructure platforms. You get one unified experience; we handle the coordination behind
          the scenes.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            { stat: "10+", label: "Ready-made applications" },
            { stat: "5", label: "Business categories covered" },
            { stat: "24/7", label: "Deployment monitoring" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-surface p-6 text-center">
              <p className="text-3xl font-semibold text-accent">{item.stat}</p>
              <p className="mt-1 text-sm text-muted">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
