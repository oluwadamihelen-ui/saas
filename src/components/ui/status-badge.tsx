import { Badge } from "./badge";

const STATUS_MAP: Record<string, { label: string; variant: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  // Orders
  PENDING_PAYMENT: { label: "Pending Payment", variant: "warning" },
  PAID: { label: "Paid", variant: "success" },
  PROCESSING: { label: "Processing", variant: "accent" },
  AWAITING_CUSTOMER: { label: "Awaiting You", variant: "warning" },
  IN_PROGRESS: { label: "In Progress", variant: "accent" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  REFUNDED: { label: "Refunded", variant: "neutral" },
  // Payments
  PENDING: { label: "Pending", variant: "warning" },
  FAILED: { label: "Failed", variant: "danger" },
  PARTIALLY_REFUNDED: { label: "Partially Refunded", variant: "neutral" },
  // Deployments
  QUEUED: { label: "Queued", variant: "neutral" },
  PREPARING: { label: "Preparing", variant: "accent" },
  CONNECTING: { label: "Connecting", variant: "accent" },
  INSTALLING: { label: "Installing", variant: "accent" },
  CONFIGURING: { label: "Configuring", variant: "accent" },
  DNS_SETUP: { label: "DNS Setup", variant: "accent" },
  SSL_SETUP: { label: "SSL Setup", variant: "accent" },
  TESTING: { label: "Testing", variant: "accent" },
  NEEDS_CUSTOMER_ACTION: { label: "Needs Your Action", variant: "warning" },
  // Domains / hosting
  ACTIVE: { label: "Active", variant: "success" },
  EXPIRED: { label: "Expired", variant: "danger" },
  SUSPENDED: { label: "Suspended", variant: "danger" },
  TRANSFERRED: { label: "Transferred", variant: "neutral" },
  TERMINATED: { label: "Terminated", variant: "neutral" },
  // Tickets
  OPEN: { label: "Open", variant: "accent" },
  WAITING_FOR_CUSTOMER: { label: "Waiting on You", variant: "warning" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CLOSED: { label: "Closed", variant: "neutral" },
  // Licenses
  REVOKED: { label: "Revoked", variant: "danger" },
  // Ticket priority
  LOW: { label: "Low", variant: "neutral" },
  MEDIUM: { label: "Medium", variant: "accent" },
  HIGH: { label: "High", variant: "warning" },
  URGENT: { label: "Urgent", variant: "danger" },
  // Health
  UNKNOWN: { label: "Unknown", variant: "neutral" },
  HEALTHY: { label: "Healthy", variant: "success" },
  WARNING: { label: "Warning", variant: "warning" },
  OFFLINE: { label: "Offline", variant: "danger" },
  // Jobs / misc
  RUNNING: { label: "Running", variant: "accent" },
  SUCCEEDED: { label: "Succeeded", variant: "success" },
  RETRYING: { label: "Retrying", variant: "warning" },
  // Applications
  DRAFT: { label: "Draft", variant: "neutral" },
  PUBLISHED: { label: "Published", variant: "success" },
  UNPUBLISHED: { label: "Unpublished", variant: "neutral" },
  ARCHIVED: { label: "Archived", variant: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status] ?? { label: status.replaceAll("_", " "), variant: "neutral" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
