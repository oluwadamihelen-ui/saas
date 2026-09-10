import { Badge } from "./badge";

const STATUS_MAP: Record<string, { label: string; variant: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  // Reservations
  PENDING: { label: "Pending", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "accent" },
  CHECKED_IN: { label: "Checked In", variant: "success" },
  CHECKED_OUT: { label: "Checked Out", variant: "neutral" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  NO_SHOW: { label: "No Show", variant: "danger" },
  // Rooms
  AVAILABLE: { label: "Available", variant: "success" },
  RESERVED: { label: "Reserved", variant: "accent" },
  OCCUPIED: { label: "Occupied", variant: "warning" },
  DIRTY: { label: "Dirty", variant: "danger" },
  CLEANING: { label: "Cleaning", variant: "accent" },
  INSPECTED: { label: "Inspected", variant: "accent" },
  MAINTENANCE: { label: "Maintenance", variant: "warning" },
  OUT_OF_SERVICE: { label: "Out of Service", variant: "danger" },
  // Payments / Invoices
  COMPLETED: { label: "Completed", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
  REFUNDED: { label: "Refunded", variant: "neutral" },
  DRAFT: { label: "Draft", variant: "neutral" },
  ISSUED: { label: "Issued", variant: "accent" },
  PAID: { label: "Paid", variant: "success" },
  VOID: { label: "Void", variant: "neutral" },
  // Housekeeping
  IN_PROGRESS: { label: "In Progress", variant: "accent" },
  // Maintenance
  REPORTED: { label: "Reported", variant: "warning" },
  ASSIGNED: { label: "Assigned", variant: "accent" },
  // Priority
  LOW: { label: "Low", variant: "neutral" },
  MEDIUM: { label: "Medium", variant: "accent" },
  HIGH: { label: "High", variant: "warning" },
  URGENT: { label: "Urgent", variant: "danger" },
  // Hotel status
  TRIAL: { label: "Trial", variant: "warning" },
  ACTIVE: { label: "Active", variant: "success" },
  SUSPENDED: { label: "Suspended", variant: "danger" },
  // Employment
  ON_LEAVE: { label: "On Leave", variant: "warning" },
  TERMINATED: { label: "Terminated", variant: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status] ?? { label: status.replaceAll("_", " "), variant: "neutral" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
