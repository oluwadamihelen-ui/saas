import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <Logo height={32} />
      <div className="space-y-2">
        <p className="text-sm font-medium text-accent">404</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="max-w-sm text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist, or you may not have access to it.</p>
      </div>
      <div className="flex gap-3">
        <Button asChild variant="secondary">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild>
          <Link href="/app">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
