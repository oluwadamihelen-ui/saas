import Link from "next/link";
import { Button } from "@/components/ui/button";

/// Windows the page-number list around the current page (1 ... 4 5 6 ... 20)
/// instead of rendering one button per page — the naive approach falls
/// apart past a couple dozen pages.
function pageWindow(current: number, total: number): (number | "...")[] {
  const delta = 1;
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  const range: (number | "...")[] = [1];
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}

export function Pagination({
  page,
  pageCount,
  basePath,
  query = {},
}: {
  page: number;
  pageCount: number;
  basePath: string;
  query?: Record<string, string | number | undefined>;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
      <Button asChild size="sm" variant="outline" disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
        <Link href={{ pathname: basePath, query: { ...query, page: Math.max(1, page - 1) } }} aria-label="Previous page">
          &larr;
        </Link>
      </Button>
      {pageWindow(page, pageCount).map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted">
            &hellip;
          </span>
        ) : (
          <Button key={p} asChild size="sm" variant={p === page ? "primary" : "outline"}>
            <Link href={{ pathname: basePath, query: { ...query, page: p } }}>{p}</Link>
          </Button>
        )
      )}
      <Button
        asChild
        size="sm"
        variant="outline"
        disabled={page >= pageCount}
        className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
      >
        <Link href={{ pathname: basePath, query: { ...query, page: Math.min(pageCount, page + 1) } }} aria-label="Next page">
          &rarr;
        </Link>
      </Button>
    </div>
  );
}
