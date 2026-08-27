import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { createUserAccount, EmailAlreadyRegisteredError, TermsNotAcceptedError } from "@/lib/accounts";
import { checkSignupRateLimit, getClientIp } from "@/lib/rateLimit";
import { Logo } from "@/components/Logo";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  async function signupAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const termsAccepted = formData.get("termsAccepted") === "on";

    const { allowed } = await checkSignupRateLimit(getClientIp(headers()));
    if (!allowed) redirect("/signup?error=ratelimit");

    try {
      await createUserAccount({ name, email, password, termsAccepted });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        redirect("/signup?error=exists");
      }
      if (error instanceof TermsNotAcceptedError) {
        redirect("/signup?error=terms");
      }
      redirect("/signup?error=1");
    }

    try {
      await signIn("credentials", { email, password, redirectTo: "/" });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login");
      }
      throw error;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cinerra-hero px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-cinerra-surface/90 p-8 shadow-glow-lg backdrop-blur-sm">
        <Logo className="mb-6 block justify-center text-center" />
        <h1 className="mb-1 text-center text-xl font-semibold">Start creating</h1>
        <p className="mb-6 text-center text-sm text-cinerra-muted">A monthly Doe allowance for generation, included with every plan.</p>

        {searchParams.error === "exists" && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">An account with that email already exists.</p>
        )}
        {searchParams.error === "terms" && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            You must accept the Terms of Service and Privacy Policy to create an account.
          </p>
        )}
        {searchParams.error === "ratelimit" && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">Too many attempts. Please try again in a while.</p>
        )}
        {searchParams.error === "1" && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">Something went wrong. Please try again.</p>
        )}

        <form action={signupAction} className="flex flex-col gap-3">
          <input name="name" required placeholder="Full name" className="input" />
          <input name="email" type="email" required placeholder="Email" className="input" />
          <input name="password" type="password" required minLength={8} placeholder="Password (min. 8 characters)" className="input" />
          <label className="mt-1 flex items-start gap-2 text-xs text-cinerra-muted">
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
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-cinerra-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-cinerra-text underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
