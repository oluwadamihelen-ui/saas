"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Could not save changes.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required maxLength={100} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" defaultValue={email} disabled />
        <p className="mt-1 text-xs text-muted-foreground">Email changes aren&apos;t supported yet.</p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
