import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function EmptyState({
  icon: Icon,
  title,
  description,
  phaseLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  phaseLabel?: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
        <Icon className="h-6 w-6 text-brand-600" />
      </div>
      <p className="font-display font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {phaseLabel && <Badge variant="neutral">{phaseLabel}</Badge>}
    </Card>
  );
}
