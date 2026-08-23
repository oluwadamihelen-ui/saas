import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  async function loginAction(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw error;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cinerra-hero px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-cinerra-surface/90 p-8 shadow-glow-lg backdrop-blur-sm">
        <Logo className="mb-6 block justify-center text-center" />
        <h1 className="mb-1 text-center text-xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-center text-sm text-cinerra-muted">Sign in to keep making movies.</p>

        {searchParams.error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">Invalid email or password.</p>
        )}

        <form action={loginAction} className="flex flex-col gap-3">
          <input name="email" type="email" required placeholder="Email" className="input" />
          <input name="password" type="password" required placeholder="Password" className="input" />
          <button type="submit" className="btn-primary mt-2 w-full">
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-cinerra-muted">
          New to Cinerra?{" "}
          <Link href="/signup" className="text-cinerra-text underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
