import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS: { key: string; label: string }[] = [
  { key: "QUEUED", label: "Order received" },
  { key: "PREPARING", label: "Application prepared" },
  { key: "CONNECTING", label: "Server connected" },
  { key: "INSTALLING", label: "Application installed" },
  { key: "CONFIGURING", label: "Environment configured" },
  { key: "DNS_SETUP", label: "DNS configuration" },
  { key: "SSL_SETUP", label: "SSL certificate" },
  { key: "TESTING", label: "Final testing" },
  { key: "COMPLETED", label: "Live" },
];

export function DeploymentTimeline({ status }: { status: string }) {
  if (status === "FAILED") {
    const lastIndex = STEPS.length - 1;
    return (
      <div className="space-y-3">
        {STEPS.slice(0, lastIndex).map((step) => (
          <div key={step.key} className="flex items-center gap-3 text-sm text-muted">
            <CheckCircle2 className="h-4 w-4 text-success" /> {step.label}
          </div>
        ))}
        <div className="flex items-center gap-3 text-sm font-medium text-danger">
          <XCircle className="h-4 w-4" /> Deployment failed — our team has been notified
        </div>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.key === status);

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
