import { CheckCircle2, XCircle, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS: { key: string; label: string }[] = [
  { key: "QUEUED", label: "Order received" },
  { key: "PREPARING", label: "Application prepared" },
  { key: "CONNECTING", label: "Server connected" },
  { key: "INSTALLING", label: "Application installed" },
  { key: "CONFIGURING", label: "Environment configured" },
  { key: "DNS_SETUP", label: "DNS configuration" },
  { key: "SSL_SETUP", label: "SSL certificate" },
  { key: "HEALTH_CHECK", label: "Running health checks" },
  { key: "COMPLETED", label: "Live" },
];

// Technical sub-steps not shown as their own row on the customer-facing
// timeline are folded into the nearest milestone so progress still advances
// visually instead of appearing stuck.
const STATUS_MILESTONE: Record<string, string> = {
  DATABASE_SETUP: "CONFIGURING",
  MIGRATING: "CONFIGURING",
};

export function DeploymentTimeline({ status }: { status: string }) {
  if (status === "FAILED" || status === "CANCELLED") {
    const lastIndex = STEPS.length - 1;
    return (
      <div className="space-y-3">
        {STEPS.slice(0, lastIndex).map((step) => (
          <div key={step.key} className="flex items-center gap-3 text-sm text-muted">
            <CheckCircle2 className="h-4 w-4 text-success" /> {step.label}
          </div>
        ))}
        <div className="flex items-center gap-3 text-sm font-medium text-danger">
          <XCircle className="h-4 w-4" />
          {status === "CANCELLED" ? "Deployment cancelled" : "Deployment failed — our team has been notified"}
        </div>
      </div>
    );
  }

  if (status === "ROLLING_BACK" || status === "ROLLED_BACK") {
    return (
      <div className="flex items-center gap-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
        <RotateCcw className="h-4 w-4" />
        {status === "ROLLING_BACK" ? "Rolling back to the previous version…" : "Rolled back to the previous version."}
      </div>
    );
  }

  const effectiveStatus = STATUS_MILESTONE[status] ?? status;
  const currentIndex = STEPS.findIndex((s) => s.key === effectiveStatus);

  return (
    <div className="space-y-3">
      {status === "NEEDS_CUSTOMER_ACTION" && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertCircle className="h-4 w-4" /> Action needed — check your notifications for details.
        </div>
      )}
      {STEPS.map((step, i) => {
        const done = currentIndex === -1 ? false : i < currentIndex || (i === currentIndex && status === "COMPLETED");
        const active = i === currentIndex && status !== "COMPLETED";
        return (
          <div key={step.key} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                done ? "bg-success text-white" : active ? "bg-accent text-white" : "border border-border text-transparent"
              )}
            >
              {done ? "✓" : active ? "●" : "○"}
            </span>
            <span className={done || active ? "text-foreground" : "text-muted"}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
