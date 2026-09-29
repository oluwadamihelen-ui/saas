"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { SidebarNav, type NavItem } from "@/components/dashboard/sidebar-nav";
import { Logo } from "@/components/brand/logo";

/** Hamburger trigger + slide-in drawer, shown only below `lg` where the fixed sidebar is hidden. */
export function MobileNav({ items, basePath, badge }: { items: NavItem[]; basePath: string; badge?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open navigation menu"
          className="-ml-2 rounded-md p-2 text-foreground hover:bg-muted-surface lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-surface p-4 lg:hidden">
          <div className="mb-6 flex items-center justify-between">
            <Link href={basePath} className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <Logo height={26} />
              {badge && (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {badge}
                </span>
              )}
            </Link>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close navigation menu" className="rounded-md p-1.5 text-muted hover:bg-muted-surface hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <div onClick={() => setOpen(false)}>
            <SidebarNav items={items} basePath={basePath} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
