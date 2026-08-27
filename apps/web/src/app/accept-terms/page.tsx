import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { acceptTerms } from "@/lib/accounts";
import { Logo } from "@/components/Logo";

/**
 * Where middleware.ts sends anyone whose account has no recorded Terms
 * acceptance — currently only reachable via Google sign-in, since /signup
 * already requires the checkbox before an account exists at all. A safe
 * relative path only: an attacker-controlled absolute callbackUrl here
 * would turn this into an open redirect.
 */
function safeCallbackUrl(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export default async function AcceptTermsPage({ searchParams }: { searchParams: { callbackUrl?: string; error?: string } }) {
  const session = await auth();
  const user = session?.user as { id?: string; hasAcceptedTerms?: boolean } | undefined;
  if (!user?.id) redirect("/login");

  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl);
  if (user.hasAcceptedTerms) redirect(callbackUrl);

  async function acceptAction(formData: FormData) {
    "use server";
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) redirect("/login");
    if (formData.get("termsAccepted") !== "on") redirect(`/accept-terms?callbackUrl=${encodeURIComponent(callbackUrl)}&error=terms`);

    await acceptTerms(userId);
    redirect(callbackUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cinerra-hero px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-cinerra-surface/90 p-8 shadow-glow-lg backdrop-blur-sm">
        <Logo className="mb-6 block justify-center text-center" />
        <h1 className="mb-1 text-center text-xl font-semibold">One more step</h1>
        <p className="mb-6 text-center text-sm text-cinerra-muted">
          Your account was created via a connected sign-in provider, which doesn&rsquo;t go through our usual signup form — we still need
          your agreement to these before you can continue.
        </p>

        {searchParams.error === "terms" && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            You must accept the Terms of Service and Privacy Policy to continue.
          </p>
        )}

        <form action={acceptAction} className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-xs text-cinerra-muted">
            <input type="checkbox" name="termsAccepted" required className="mt-0.5 accent-cinerra-accent" />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-cinerra-text underline" target="_blank">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-cinerra-text underline" target="_blank">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <button type="submit" className="btn-primary mt-2 w-full">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
