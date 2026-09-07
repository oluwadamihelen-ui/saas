import Link from "next/link";
import type { Metadata } from "next";
import { ApplicationCard } from "@/components/marketplace/application-card";
import { EmptyState } from "@/components/ui/empty-state";
import { listCategories, listPublishedApplications } from "@/lib/services/applications";
import { cn } from "@/lib/utils";
import { PackageSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Application Marketplace",
  description: "Browse production-ready web applications you can buy, customize and deploy today.",
};

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
];

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1) || 1;

  const [result, categories] = await Promise.all([
    listPublishedApplications({
      search: params.q,
      categorySlug: params.category,
      sort: (params.sort as never) ?? "featured",
      page,
    }),
    listCategories(),
  ]);

  return (
    <div className="container-shell py-14">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Application Marketplace</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {result.total} production-ready applications, ready to demo, buy, and deploy.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-6">
          <form className="flex gap-2" action="/apps">
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="Search applications..."
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
            />
          </form>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Category</p>
            <ul className="mt-3 space-y-1">
              <li>
                <Link
                  href="/apps"
                  className={cn(
                    "block rounded-md px-2 py-1.5 text-sm",
                    !params.category ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                  )}
                >
                  All Categories
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/apps?category=${category.slug}`}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
                      params.category === category.slug ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                    )}
                  >
                    {category.name}
                    <span className="text-xs">{category._count.applications}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sort By</p>
            <ul className="mt-3 space-y-1">
              {SORT_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <Link
                    href={`/apps?${new URLSearchParams({ ...params, sort: opt.value } as Record<string, string>).toString()}`}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm",
                      (params.sort ?? "featured") === opt.value ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div>
          {result.items.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="h-8 w-8" />}
              title="No applications found"
              description="Try a different search term or browse all categories."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={{ ...app, pricing: app.pricing.map((p) => ({ ...p, amount: Number(p.amount) })) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
