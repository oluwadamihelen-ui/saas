import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
  /// Tighter padding and a smaller value size for denser layouts (the
  /// overview dashboard's stat row) — off by default so platform/finance
  /// pages using the regular size are unaffected.
  compact,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Card className={cn(className)}>
      <CardContent className={cn(compact ? "space-y-1 p-4" : "space-y-1.5")}>
        <p className={cn("text-muted", compact ? "text-xs" : "text-sm")}>{label}</p>
        <p className={cn("font-semibold tracking-tight text-foreground", compact ? "text-xl" : "text-2xl")}>{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}
