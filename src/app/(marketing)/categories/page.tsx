import type { Metadata } from "next";
import Link from "next/link";
import { listCategories } from "@/lib/services/applications";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <div className="container-shell py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
      <p className="mt-2 max-w-2xl text-muted">Browse the marketplace by business type.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/apps?category=${category.slug}`}
            className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-accent hover:bg-accent-soft"
          >
            <p className="text-lg font-semibold text-foreground">{category.name}</p>
            {category.description && <p className="mt-1 text-sm text-muted">{category.description}</p>}
            <p className="mt-3 text-xs font-medium text-accent">{category._count.applications} applications</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
