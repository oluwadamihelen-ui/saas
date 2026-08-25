import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-sm font-semibold text-brand-500">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Button href="/" variant="secondary">
          Go home
        </Button>
        <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-full bg-brand-500 px-6 text-sm font-medium text-white hover:bg-brand-600">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
