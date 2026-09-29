"use client";

import { useState, useTransition } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createDemoAccountAction } from "./actions";

interface ExistingDemoAccount {
  ownerEmail: string;
  password: string;
  branchNames: string[];
}

export function DemoAccountPanel({ existing, fallbackEmail }: { existing: ExistingDemoAccount | null; fallbackEmail: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ExistingDemoAccount | null>(existing);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(null);

  function copy(field: "email" | "password", value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await createDemoAccountAction();
            if (res.status === "success") {
              setResult({ ownerEmail: res.ownerEmail!, password: res.password!, branchNames: res.branchNames! });
            } else {
              setError(res.message ?? "Unable to create the demo account right now.");
            }
          })
        }
      >
        {isPending ? "Setting up demo account..." : result ? "Regenerate credentials view" : "Create demo account"}
      </Button>
      {!result && !isPending && (
        <p className="text-sm text-muted">
          This will create a login (<span className="font-mono">{fallbackEmail}</span>) with two hotel branches and a
          full spread of sample data. Takes a few seconds.
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {result && (
        <div className="space-y-3 rounded-md border border-border bg-muted-surface p-4">
          <div className="space-y-1.5">
            <Label>Login email</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={result.ownerEmail} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" size="sm" variant="ghost" onClick={() => copy("email", result.ownerEmail)}>
                {copiedField === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={result.password} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" size="sm" variant="ghost" onClick={() => copy("password", result.password)}>
                {copiedField === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Branches on this login</Label>
            <ul className="text-sm text-foreground">
              {result.branchNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">
            Share these with the prospect along with the login page. They&apos;ll land on the first branch and can
            switch to the other one from the hotel switcher in the top bar.
          </p>
        </div>
      )}
    </div>
  );
}
