"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/// Same "no email provider — hand a one-time secret to the admin to copy
/// and share themselves" reasoning as CopyLinkButton, for a login rather
/// than a link.
export function CopyCredentialsButton({ email, password }: { email: string; password: string }) {
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
