import { Badge } from "@/components/ui/badge";
import type { RiskLevel, TrendStatus } from "@/lib/services/performance/types";

const RISK_VARIANT: Record<RiskLevel, "success" | "warning" | "danger"> = {
  LOW: "success",
  MODERATE: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
};
const RISK_LABEL: Record<RiskLevel, string> = { LOW: "Low", MODERATE: "Moderate", HIGH: "High", CRITICAL: "Critical" };

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge variant={RISK_VARIANT[level]}>{RISK_LABEL[level]}</Badge>;
}

const TREND_VARIANT: Record<TrendStatus, "success" | "warning" | "danger" | "neutral"> = {
  IMPROVING: "success",
  STABLE: "neutral",
  DECLINING: "danger",
  INSUFFICIENT_DATA: "neutral",
};
const TREND_LABEL: Record<TrendStatus, string> = {
  IMPROVING: "Improving",
  STABLE: "Stable",
  DECLINING: "Declining",
  INSUFFICIENT_DATA: "Insufficient data",
};

export function TrendBadge({ status }: { status: TrendStatus }) {
  return <Badge variant={TREND_VARIANT[status]}>{TREND_LABEL[status]}</Badge>;
}
