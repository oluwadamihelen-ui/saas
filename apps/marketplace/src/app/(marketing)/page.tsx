import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ServicesGrid } from "@/components/marketing/services-grid";
import { WhyChooseUs } from "@/components/marketing/why-choose-us";
import { Testimonials } from "@/components/marketing/testimonials";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";
import { DomainSearchBox } from "@/components/marketing/domain-search-box";
import { ApplicationCard } from "@/components/marketplace/application-card";
import { listCategories, listFeaturedApplications } from "@/lib/services/applications";

export default async function HomePage() {
  const [featured, categories] = await Promise.all([listFeaturedApplications(6), listCategories()]);

  return (
    <>
      <Hero />

      <section className="border-b border-border bg-background py-20">
        <div className="container-shell">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Featured Applications</h2>
              <p className="mt-2 text-muted">Hand-picked, production-ready software ready to deploy today.</p>
            </div>
            <Link href="/apps" className="hidden shrink-0 items-center gap-1 text-sm font-medium text-accent sm:flex">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((app) => (
              <ApplicationCard
                key={app.id}
                app={{
                  ...app,
                  pricing: app.pricing.map((p) => ({ ...p, amount: Number(p.amount) })),
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface py-20">
        <div className="container-shell">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Browse by Category</h2>
            <p className="mt-2 text-muted">Find the right application for your business model.</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/apps?category=${category.slug}`}
                className="rounded-lg border border-border bg-background p-5 text-center transition-colors hover:border-accent hover:bg-accent-soft"
              >
                <p className="text-sm font-semibold text-foreground">{category.name}</p>
                <p className="mt-1 text-xs text-muted">{category._count.applications} apps</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />
      <ServicesGrid />

      <section className="border-b border-border bg-background py-20">
        <div className="container-shell text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Find your domain</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            Search availability across popular extensions and register instantly during checkout.
          </p>
          <div className="mt-10">
            <DomainSearchBox />
          </div>
        </div>
      </section>

      <WhyChooseUs />
      <Testimonials />
      <FAQ />
      <FinalCTA />
    </>
  );
}
