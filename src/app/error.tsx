"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-sm font-semibold text-danger">Something went wrong</p>
      <h1 className="mt-2 font-display text-3xl font-bold">An unexpected error occurred</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        We&apos;ve logged the issue. Try again, or head back to the dashboard.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset} variant="secondary">
          Try again
        </Button>
        <Button href="/dashboard">Go to dashboard</Button>
      </div>
    </div>
  );
}
