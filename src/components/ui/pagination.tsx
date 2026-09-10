import Link from "next/link";
import { Button } from "./button";

export function Pagination({ basePath, page, pageCount, searchParams }: { basePath: string; page: number; pageCount: number; searchParams?: Record<string, string | undefined> }) {
  if (pageCount <= 1) return null;

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3">
      <p className="text-xs text-muted">
        Page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
          <Link href={buildHref(Math.max(1, page - 1))}>Previous</Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className={page >= pageCount ? "pointer-events-none opacity-50" : ""}>
          <Link href={buildHref(Math.min(pageCount, page + 1))}>Next</Link>
        </Button>
      </div>
    </div>
  );
}
