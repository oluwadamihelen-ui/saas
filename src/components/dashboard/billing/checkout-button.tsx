"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function CheckoutButton({
  endpoint,
  body,
  children,
  ...buttonProps
}: {
  endpoint: string;
  body: Record<string, unknown>;
} & Omit<ButtonProps, "onClick" | "href">) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div>
      <Button {...buttonProps} onClick={onClick} disabled={loading || buttonProps.disabled}>
        {loading ? "Redirecting…" : children}
      </Button>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
