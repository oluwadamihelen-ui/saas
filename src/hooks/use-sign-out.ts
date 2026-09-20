"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

/// Plain `signOut({ callbackUrl: "/" })` resolves that relative URL against
/// the server's configured AUTH_URL/NEXTAUTH_URL origin, not the host the
/// request actually came in on (same quirk documented on the Host-header
/// handling in middleware.ts) — on a tenant subdomain like
/// demo.schoolum.io, that sent people back to the main site instead of
/// keeping them on the subdomain they signed out from. Skipping next-auth's
/// own redirect and navigating client-side (same as login-form.tsx's own
/// router.push + router.refresh) stays on whatever host the browser is
/// actually on instead.
export function useSignOut() {
  const router = useRouter();
  return async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };
}
