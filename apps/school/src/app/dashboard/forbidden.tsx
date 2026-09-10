import { AccessDenied } from "@/components/errors/access-denied";

/// Catches forbidden() calls thrown anywhere under /dashboard — every
/// requirePermission/requireAnyPermission call that fails there lands here
/// instead of the framework's generic error page.
export default function DashboardForbidden() {
  return <AccessDenied homeHref="/dashboard" homeLabel="Go to dashboard" />;
}
