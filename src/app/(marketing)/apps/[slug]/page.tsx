import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenshotCarousel } from "@/components/marketplace/screenshot-carousel";
import { getApplicationBySlug } from "@/lib/services/applications";
import { formatCurrency } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = await getApplicationBySlug(slug);
  if (!app) return {};
  return {
    title: app.seoTitle ?? app.name,
    description: app.seoDescription ?? app.shortDescription,
    alternates: { canonical: `/apps/${app.slug}` },
    openGraph: {
      title: app.seoTitle ?? app.name,
      description: app.seoDescription ?? app.shortDescription,
      images: app.ogImageUrl ? [app.ogImageUrl] : app.images[0] ? [app.images[0].url] : [],
    },
  };
}

const PRICING_LABELS: Record<string, string> = {
  LICENSE: "Software License",
  INSTALLATION: "Installation",
  CUSTOMIZATION: "Customization",
  HOSTING: "Hosting",
  MAINTENANCE: "Maintenance",
  DOMAIN: "Domain",
  SUPPORT: "Support",
};

export default async function ApplicationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await getApplicationBySlug(slug);
  if (!app) notFound();

  const license = app.pricing.find((p) => p.type === "LICENSE");

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: app.name,
    description: app.shortDescription,
    applicationCategory: app.category.name,
    offers: license
      ? { "@type": "Offer", price: Number(license.amount), priceCurrency: license.currency }
      : undefined,
  };

  return (
    <div className="container-shell py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <nav className="mb-6 text-sm text-muted">
        <Link href="/apps" className="hover:text-foreground">
          Apps
        </Link>{" "}
        / <span className="text-foreground">{app.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="accent">{app.category.name}</Badge>
              {app.featured && <Badge variant="warning">Featured</Badge>}
              <Badge variant="neutral">v{app.currentVersion}</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{app.name}</h1>
            <p className="mt-3 max-w-2xl text-lg text-muted">{app.shortDescription}</p>
          </div>

          {app.images.length > 0 && <ScreenshotCarousel images={app.images} appName={app.name} />}

          <section>
            <h2 className="text-xl font-semibold">Overview</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{app.fullDescription}</p>
          </section>

          {app.features.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">Features</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {app.features.map((f) => (
                  <li key={f.id} className="flex gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <div>
                      <p className="font-medium text-foreground">{f.title}</p>
                      {f.description && <p className="text-muted">{f.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold">Technology Stack</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {app.technologyStack.map((tech) => (
                <Badge key={tech} variant="neutral">
                  {tech}
                </Badge>
              ))}
            </div>
          </section>

          {app.requirements.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">Requirements</h2>
              <ul className="mt-3 list-inside list-disc text-sm text-muted">
                {app.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-8 sm:grid-cols-2">
            {app.whatsIncluded.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold">What&apos;s Included</h2>
                <ul className="mt-3 space-y-2">
                  {app.whatsIncluded.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {app.whatsNotIncluded.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold">What&apos;s Not Included</h2>
                <ul className="mt-3 space-y-2">
                  {app.whatsNotIncluded.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section>
            <h2 className="text-xl font-semibold">Deployment Options</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { title: "Your Server", description: "Deploy to a server or hosting account you already own." },
                { title: "Our Hosting", description: "Purchase managed hosting through the platform." },
                { title: "Managed Deployment", description: "Request a fully managed setup handled by our team." },
              ].map((opt) => (
                <div key={opt.title} className="rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">{opt.title}</p>
                  <p className="mt-1 text-xs text-muted">{opt.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            {license && (
              <p className="text-3xl font-semibold text-foreground">
                {formatCurrency(Number(license.amount), license.currency)}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">One-time license · installation and hosting available at checkout</p>

            <div className="mt-6 space-y-3">
              <Button asChild size="lg" className="w-full">
                <Link href={`/checkout/${app.slug}`}>Purchase Application</Link>
              </Button>
              {app.demoUrl && (
                <Button asChild variant="secondary" size="lg" className="w-full">
                  <a href={app.demoUrl} target="_blank" rel="noopener noreferrer">
                    View Live Demo <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>

            {app.demoUrl && (app.demoUsername || app.demoPassword) && (
              <div className="mt-4 rounded-md bg-muted-surface p-3 text-xs text-muted">
                <p className="font-medium text-foreground">Demo credentials</p>
                {app.demoUsername && <p>Username: {app.demoUsername}</p>}
                {app.demoPassword && <p>Password: {app.demoPassword}</p>}
              </div>
            )}

            <div className="mt-6 space-y-3 border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pricing Breakdown</p>
              {app.pricing.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{PRICING_LABELS[p.type] ?? p.name}</span>
                  <span className="font-medium text-foreground">
                    {p.isStartingFrom && "From "}
                    {formatCurrency(Number(p.amount), p.currency)}
                    {p.billingCycle === "MONTHLY" && "/mo"}
                    {p.billingCycle === "YEARLY" && "/yr"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
