"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  children?: NavItem[];
}

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href && (item.exact ? pathname === item.href : pathname.startsWith(item.href))) return true;
  return item.children?.some((c) => isActive(c, pathname)) ?? false;
}

function collectActiveGroupLabels(items: NavItem[], pathname: string, acc: Set<string>) {
  for (const item of items) {
    if (item.children && isActive(item, pathname)) {
      acc.add(item.label);
      collectActiveGroupLabels(item.children, pathname, acc);
    }
  }
}

export type NavTheme = "light" | "navy";

/// Recursive, permission-agnostic nav renderer shared by the desktop
/// sidebar and the mobile NavDrawer — filtering by permission happens
/// before items reach here (see visibleNavFor in sidebar.tsx), so this
/// component only knows about hrefs, labels and nesting. Groups (items
/// with children) expand/collapse; whichever group chain contains the
/// current route starts open.
///
/// `theme="navy"` is the dark Schoolum sidebar palette (see globals.css
/// --navy-* tokens) — used by the persistent desktop sidebars. The
/// slide-out mobile NavDrawer always stays "light" for on-glass
/// readability regardless of the desktop sidebar's theme.
export function NavTree({
  items,
  onNavigate,
  depth = 0,
  theme = "light",
}: {
  items: NavItem[];
  onNavigate?: () => void;
  depth?: number;
  theme?: NavTheme;
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const acc = new Set<string>();
    collectActiveGroupLabels(items, pathname, acc);
    return acc;
  });

  function toggle(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const navy = theme === "navy";

  return (
    <div className={cn("space-y-0.5", depth > 0 && cn("ml-4 border-l pl-3", navy ? "border-navy-border" : "border-border"))}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item, pathname);
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isOpen = openGroups.has(item.label);

        if (hasChildren) {
          return (
            <div key={item.label}>
              <button
                type="button"
                onClick={() => toggle(item.label)}
                aria-expanded={isOpen}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  navy
                    ? active
                      ? "text-white"
                      : "text-navy-muted hover:bg-navy-hover hover:text-white"
                    : active
                      ? "text-accent"
                      : "text-muted hover:bg-muted-surface hover:text-foreground"
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="mt-0.5">
                  <NavTree items={item.children!} onNavigate={onNavigate} depth={depth + 1} theme={theme} />
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href!}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              navy
                ? active
                  ? "bg-navy-active text-white"
                  : "text-navy-muted hover:bg-navy-hover hover:text-white"
                : active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-muted-surface hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
