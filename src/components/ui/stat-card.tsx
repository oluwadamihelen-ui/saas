import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

const NON_BREAKING_SPACE = " ";

/**
 * A single stat tile (icon + value + label). Three rules keep a long value
 * (a currency amount, in particular) from pushing the card wider than its
 * grid cell -- the "floating off the grid" bug:
 * 1. `min-w-0` on the text column -- flex items default to `min-width:
 *    auto`, which blocks shrinking/wrapping entirely.
 * 2. formatCurrency() (Intl.NumberFormat) joins the currency code and the
 *    amount with a non-breaking space -- correct for a single-line table
 *    cell, but on a narrow tile it leaves the browser no valid place to
 *    wrap, so it fractures the digits themselves (e.g. "NGN 16" / "0,300").
 *    Swapping that for a normal space gives it a real break point.
 * 3. `break-words` as a fallback, only for the rare case a single token is
 *    still too wide even after (2).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon?: ComponentType<{ className?: string }>;
  tone?: "default" | "danger";
}) {
  const display = typeof value === "string" ? value.split(NON_BREAKING_SPACE).join(" ") : value;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft">
            <Icon className="h-5 w-5 text-accent" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("break-words text-lg font-semibold leading-snug sm:text-xl", tone === "danger" ? "text-danger" : "text-foreground")}>{display}</p>
          <p className="text-xs text-muted">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Shared responsive grid for a row of StatCards -- consistent breakpoints
 * everywhere they're used. Single column below `sm` (real phone widths,
 * ~320-480px) rather than two: a two-up grid at that width leaves too
 * little room for a currency value to sit on one line, which is what was
 * forcing mid-number wrapping in the first place.
 */
export function StatCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5", className)}>{children}</div>;
}
