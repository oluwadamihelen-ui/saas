"use client";

import { useActionState, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { convertInquiryToBuyerAction, type ConvertToBuyerState } from "./actions";

const initialState: ConvertToBuyerState = { status: "idle" };

function CopyCredentialsButton({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${password}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy these credentials:", `Email: ${email}\nTemporary password: ${password}`);
        }
      }}
    >
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy credentials"}
    </Button>
  );
}

export function ConvertToBuyerForm({ inquiryId }: { inquiryId: string }) {
  const [state, formAction, isPending] = useActionState(convertInquiryToBuyerAction, initialState);
  const [open, setOpen] = useState(false);

  if (state.status === "success" && state.credentials) {
    return (
      <div className="space-y-2 rounded-md border border-success/30 bg-success-soft p-3 text-sm">
        <p className="font-medium text-foreground">Buyer account created — share these credentials now, they won&apos;t be shown again:</p>
        <p className="text-muted">
          Email: <span className="font-mono text-foreground">{state.credentials.email}</span>
        </p>
        <p className="text-muted">
          Temporary password: <span className="font-mono text-foreground">{state.credentials.temporaryPassword}</span>
        </p>
        <CopyCredentialsButton email={state.credentials.email} password={state.credentials.temporaryPassword} />
      </div>
    );
  }

  if (!open) {
    return <Button type="button" size="sm" onClick={() => setOpen(true)}>Convert to Buyer</Button>;
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <div className="space-y-1.5">
        <Label htmlFor={`displayName-${inquiryId}`}>Buyer display name</Label>
        <Input id={`displayName-${inquiryId}`} name="displayName" required placeholder="Company or contact name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`phone-${inquiryId}`}>Phone (optional)</Label>
        <Input id={`phone-${inquiryId}`} name="phone" type="tel" placeholder="+234..." />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Creating..." : "Create Buyer account"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
