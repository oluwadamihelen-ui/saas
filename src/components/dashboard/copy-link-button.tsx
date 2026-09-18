"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/// Schoolum has no email provider (see lib/services/staff.ts) — every
/// invite/password-setup link is handed to the admin to copy and share
/// themselves. `path` is relative (e.g. "/invite/abc123"); this resolves
/// it against the browser's own origin so what's copied is a real,
/// clickable URL rather than a path fragment the admin has to prepend
/// their school's domain to by hand.
export function CopyLinkButton({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — fall back to a
      // selectable prompt rather than failing silently.
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
