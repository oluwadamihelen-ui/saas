import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { createUserAccount, EmailAlreadyRegisteredError } from "@/lib/accounts";
import { Logo } from "@/components/Logo";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  async function signupAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      await createUserAccount({ name, email, password });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        redirect("/signup?error=exists");
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
      <div className="w-full max-w-sm rounded-2xl border border-cinerra-border bg-cinerra-surface p-8">
        <Logo className="mb-6 block text-center" />
        <h1 className="mb-1 text-center text-xl font-semibold">Start creating</h1>
        <p className="mb-6 text-center text-sm text-cinerra-muted">Unlimited AI movie creation. No credits, ever.</p>

        {searchParams.error === "exists" && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">An account with that email already exists.</p>
        )}
        {searchParams.error === "1" && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">Something went wrong. Please try again.</p>
        )}

        <form action={signupAction} className="flex flex-col gap-3">
          <input name="name" required placeholder="Full name" className="input" />
          <input name="email" type="email" required placeholder="Email" className="input" />
          <input name="password" type="password" required minLength={8} placeholder="Password (min. 8 characters)" className="input" />
          <button type="submit" className="mt-2 rounded-full bg-cinerra-accent py-2.5 text-sm font-semibold text-white hover:brightness-110">
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
