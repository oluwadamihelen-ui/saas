import { AccessDenied } from "@/components/errors/access-denied";

/// Root fallback for forbidden() (next/navigation) calls that don't have a
/// closer boundary — src/app/dashboard/forbidden.tsx, portal/forbidden.tsx
/// and platform/forbidden.tsx cover those areas specifically. Requires
/// experimental.authInterrupts in next.config.ts.
export default function Forbidden() {
  return <AccessDenied homeHref="/" homeLabel="Go to homepage" />;
}
