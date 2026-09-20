"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavTree, type NavItem } from "@/components/ui/nav-tree";

export type { NavItem };

/// Renders both the mobile hamburger trigger and its slide-out drawer as one
/// unit so open/close state doesn't need to be lifted into the server-rendered
/// layout. The drawer uses fixed positioning, so it's safe to mount this
/// wherever in the tree — it doesn't need to sit inside the (desktop-only,
/// `hidden md:flex`) sidebar it mirrors.
export function NavDrawer({ items, homeHref, logo }: { items: NavItem[]; homeHref: string; logo?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="-ml-2 rounded-md p-2 text-muted hover:bg-muted-surface hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link href={homeHref} onClick={() => setOpen(false)}>
                {logo ?? <Logo height={24} />}
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-2 text-muted hover:bg-muted-surface hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <NavTree items={items} onNavigate={() => setOpen(false)} />
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
