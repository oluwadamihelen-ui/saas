import { cn } from "@/lib/utils";
import type { OnboardingStep } from "@/lib/services/school";

const STEPS: { key: OnboardingStep; label: string }[] = [
  { key: "school-info", label: "School information" },
  { key: "academic-structure", label: "Academic structure" },
  { key: "invite-staff", label: "Invite staff" },
];

export function OnboardingStepper({ current }: { current: OnboardingStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-8 flex items-center gap-2 text-sm">
      {STEPS.map((step, i) => {
        const done = currentIndex > i || current === "done";
        const active = step.key === current;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                done ? "bg-accent text-accent-foreground" : active ? "bg-accent-soft text-accent" : "bg-muted-surface text-muted"
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={cn(active ? "font-medium text-foreground" : "text-muted")}>{step.label}</span>
            {i < STEPS.length - 1 && <span className="mx-2 h-px w-8 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
