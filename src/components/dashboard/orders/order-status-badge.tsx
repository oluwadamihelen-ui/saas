import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, "default" | "secondary" | "outline" | "success" | "warning" | "destructive"> = {
  PENDING: "outline",
  CONFIRMED: "secondary",
  PAID: "success",
  PROCESSING: "warning",
  READY: "warning",
  SHIPPED: "secondary",
  DELIVERED: "success",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANT[status] ?? "outline"}>{status}</Badge>;
}
