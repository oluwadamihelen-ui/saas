import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/accounts";
import { checkPasswordResetRateLimit, getClientIp } from "@/lib/rateLimit";
import { Logo } from "@/components/Logo";

export default function ForgotPasswordPage({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  async function forgotPasswordAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");

    const { allowed } = await checkPasswordResetRateLimit(getClientIp(headers()));
    if (!allowed) redirect("/forgot-password?error=ratelimit");

    await requestPasswordReset(email);
    redirect("/forgot-password?sent=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cinerra-hero px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-cinerra-surface/90 p-8 shadow-glow-lg backdrop-blur-sm">
        <Logo className="mb-6 block justify-center text-center" />
        <h1 className="mb-1 text-center text-xl font-semibold">Reset your password</h1>
        <p className="mb-6 text-center text-sm text-cinerra-muted">We&rsquo;ll email you a link to set a new one.</p>

        {searchParams.sent ? (
          <p className="rounded-lg bg-cinerra-accent/10 px-3 py-3 text-center text-sm text-cinerra-text">
            If an account exists for that email, a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <>
            {searchParams.error === "ratelimit" && (
              <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">Too many attempts. Please try again in a while.</p>
            )}
            <form action={forgotPasswordAction} className="flex flex-col gap-3">
              <input name="email" type="email" required placeholder="Email" className="input" />
              <button type="submit" className="btn-primary mt-2 w-full">
                Send reset link
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-cinerra-muted">
          <Link href="/login" className="text-cinerra-text underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
