"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNav({ links, isAuthenticated }: { links: { href: string; label: string }[]; isAuthenticated: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-border bg-surface p-4 shadow-lg">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted-surface"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Button asChild variant="secondary" className="flex-1">
              <Link href={isAuthenticated ? "/dashboard" : "/login"}>{isAuthenticated ? "Dashboard" : "Login"}</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href="/apps">Get Started</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
