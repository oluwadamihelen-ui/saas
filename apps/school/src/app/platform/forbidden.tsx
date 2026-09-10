import { AccessDenied } from "@/components/errors/access-denied";

/// Catches forbidden() calls thrown anywhere under /platform (requireSuperAdmin).
export default function PlatformForbidden() {
  return <AccessDenied homeHref="/platform" homeLabel="Go to platform admin" />;
}
