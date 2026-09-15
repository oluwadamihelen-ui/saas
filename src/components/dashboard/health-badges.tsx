import { Badge } from "@/components/ui/badge";
import type { HealthLevel, ActionPriority, HealthTrendStatus } from "@/lib/services/school-health/types";

const LEVEL_VARIANT: Record<HealthLevel, "success" | "accent" | "warning" | "danger"> = {
  EXCELLENT: "success",
  GOOD: "accent",
  NEEDS_ATTENTION: "warning",
  CRITICAL: "danger",
};
const LEVEL_LABEL: Record<HealthLevel, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  NEEDS_ATTENTION: "Needs Attention",
  CRITICAL: "Critical",
};

/// Always paired with its text label (never color alone) — accessibility
/// requirement carried over from the Performance Analysis risk badges.
export function HealthLevelBadge({ level }: { level: HealthLevel }) {
  return <Badge variant={LEVEL_VARIANT[level]}>{LEVEL_LABEL[level]}</Badge>;
}

const PRIORITY_VARIANT: Record<ActionPriority, "danger" | "warning" | "accent" | "neutral"> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  INFORMATIONAL: "neutral",
};
const PRIORITY_LABEL: Record<ActionPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  INFORMATIONAL: "Informational",
};

export function ActionPriorityBadge({ priority }: { priority: ActionPriority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

const TREND_VARIANT: Record<HealthTrendStatus, "success" | "warning" | "danger" | "neutral"> = {
  IMPROVING: "success",
  STABLE: "neutral",
  DECLINING: "danger",
  INSUFFICIENT_DATA: "neutral",
};
const TREND_LABEL: Record<HealthTrendStatus, string> = {
  IMPROVING: "Improving",
  STABLE: "Stable",
  DECLINING: "Declining",
  INSUFFICIENT_DATA: "Insufficient data",
};

export function HealthTrendBadge({ status }: { status: HealthTrendStatus }) {
  return <Badge variant={TREND_VARIANT[status]}>{TREND_LABEL[status]}</Badge>;
}
