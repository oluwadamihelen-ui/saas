import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container-shell flex items-center justify-between py-6">
        <Logo height={32} />
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>
      <main className="container-shell flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Run your school on one AI-native platform
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Students, staff, academics, attendance, finance and communication —
          built for African schools, from onboarding to report cards.
        </p>
        <div className="flex items-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">Set up your school</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
