import { redirect } from "next/navigation";
import type { Session } from "next-auth";

/**
 * Call right after the existing "redirect to /login if unauthenticated"
 * check on every page that requires a signed-in user. Google sign-in
 * creates the User row via NextAuth's own Prisma adapter, bypassing
 * /signup's required Terms/Privacy checkbox — anyone who reached the app
 * that way (or any other future non-/signup account-creation path) has no
 * recorded acceptance and is sent to /accept-terms before doing anything
 * else, rather than the app treating sign-in itself as consent.
 */
export function requireAcceptedTerms(session: Session | null, currentPath: string): void {
  const user = session?.user as { hasAcceptedTerms?: boolean } | undefined;
  if (!user?.hasAcceptedTerms) redirect(`/accept-terms?callbackUrl=${encodeURIComponent(currentPath)}`);
}
