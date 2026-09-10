import { AccessDenied } from "@/components/errors/access-denied";

/// Catches forbidden() calls thrown anywhere under /portal (both
/// /portal/parent and /portal/student share this one boundary).
export default function PortalForbidden() {
  return <AccessDenied homeHref="/portal" homeLabel="Go to portal" />;
}
