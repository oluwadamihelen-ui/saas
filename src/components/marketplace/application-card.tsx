import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export interface ApplicationCardData {
  slug: string;
  name: string;
  shortDescription: string;
  technologyStack: string[];
  featured: boolean;
  category: { name: string; slug: string };
  images: { url: string; altText: string | null }[];
  pricing: { amount: unknown; currency: string }[];
}

export function ApplicationCard({ app }: { app: ApplicationCardData }) {
  const price = app.pricing[0];
  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted-surface">
        {app.images[0] ? (
          <img
            src={app.images[0].url}
            alt={app.images[0].altText ?? app.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-muted">
            {app.name.slice(0, 1)}
          </div>
        )}
        {app.featured && (
          <Badge variant="accent" className="absolute left-3 top-3">
            <Star className="h-3 w-3" /> Featured
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">{app.category.name}</span>
          {price && (
            <span className="text-sm font-semibold text-foreground">{formatCurrency(price.amount as never, price.currency)}</span>
          )}
        </div>
        <h3 className="text-base font-semibold text-foreground group-hover:text-accent">{app.name}</h3>
        <p className="line-clamp-2 text-sm text-muted">{app.shortDescription}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {app.technologyStack.slice(0, 3).map((tech) => (
            <Badge key={tech} variant="neutral">
              {tech}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
