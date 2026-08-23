import { redirect } from "next/navigation";
import Link from "next/link";
import { resetPassword, InvalidResetTokenError } from "@/lib/accounts";
import { Logo } from "@/components/Logo";

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string; error?: string } }) {
  const token = searchParams.token ?? "";

  async function resetPasswordAction(formData: FormData) {
    "use server";
    const submittedToken = String(formData.get("token") ?? "");
    const newPassword = String(formData.get("password") ?? "");

    try {
      await resetPassword(submittedToken, newPassword);
    } catch (error) {
      if (error instanceof InvalidResetTokenError) {
        redirect("/reset-password?error=invalid");
      }
      throw error;
    }

    redirect("/login?reset=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cinerra-hero px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-cinerra-surface/90 p-8 shadow-glow-lg backdrop-blur-sm">
        <Logo className="mb-6 block justify-center text-center" />
        <h1 className="mb-1 text-center text-xl font-semibold">Set a new password</h1>

        {(!token || searchParams.error === "invalid") ? (
          <div className="mt-4 flex flex-col items-center gap-3 text-center">
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              This reset link is invalid or has expired.
            </p>
            <Link href="/forgot-password" className="text-sm text-cinerra-text underline">
              Request a new link
            </Link>
          </div>
        ) : (
          <form action={resetPasswordAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="token" value={token} />
            <input name="password" type="password" required minLength={8} placeholder="New password (min. 8 characters)" className="input" />
            <button type="submit" className="btn-primary mt-2 w-full">
              Update password
            </button>
          </form>
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
