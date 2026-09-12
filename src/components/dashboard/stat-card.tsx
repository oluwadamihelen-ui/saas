import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardContent className="space-y-1.5">
        <p className="text-sm text-muted">{label}</p>
        <p className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}
