import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyEmail, InvalidVerificationTokenError } from "@/lib/accounts";
import { Logo } from "@/components/Logo";

/**
 * Confirmation requires an explicit button click rather than consuming the
 * token the moment this page is requested — some email clients' security
 * scanners (Outlook Safe Links, Proofpoint, etc.) automatically GET-fetch
 * every link in an email to check it, which would silently burn a
 * GET-consumed single-use token before the real person ever sees it.
 */
export default function VerifyEmailPage({ searchParams }: { searchParams: { token?: string; error?: string; done?: string } }) {
  const token = searchParams.token ?? "";

  async function confirmAction() {
    "use server";
    if (!token) redirect("/verify-email?error=invalid");
    try {
      await verifyEmail(token);
    } catch (error) {
      if (error instanceof InvalidVerificationTokenError) {
        redirect("/verify-email?error=invalid");
      }
      throw error;
    }
    redirect("/verify-email?done=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cinerra-hero px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-cinerra-surface/90 p-8 shadow-glow-lg backdrop-blur-sm text-center">
        <Logo className="mb-6 block justify-center" />

        {searchParams.done === "1" ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">Email confirmed</h1>
            <p className="mt-3 text-sm text-cinerra-muted">Your email address is verified. You&rsquo;re all set.</p>
            <Link href="/" className="btn-primary mt-6 inline-flex w-full justify-center">
              Go to FilmDoe
            </Link>
          </>
        ) : !token || searchParams.error === "invalid" ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">Link invalid or expired</h1>
            <p className="mt-3 text-sm text-cinerra-muted">
              This confirmation link is invalid or has expired. Request a new one from your profile page.
            </p>
            <Link href="/profile" className="text-sm text-cinerra-text underline mt-6 inline-block">
              Go to your profile
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold">Confirm your email</h1>
            <p className="mt-3 text-sm text-cinerra-muted">Confirm that this is your email address to finish setting up your account.</p>
            <form action={confirmAction} className="mt-6">
              <button type="submit" className="btn-primary w-full">
                Confirm email
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
