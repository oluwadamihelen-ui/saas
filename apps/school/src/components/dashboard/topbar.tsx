"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell, type NotificationItem } from "@/components/dashboard/notification-bell";

export function DashboardTopbar({
  name,
  email,
  roleName,
  notifications = [],
  unreadCount = 0,
  mobileNav,
}: {
  name: string;
  email: string;
  roleName: string;
  notifications?: NotificationItem[];
  unreadCount?: number;
  mobileNav?: React.ReactNode;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <div>{mobileNav}</div>
      <div className="flex items-center gap-2 sm:gap-4">
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted">{roleName} · {email}</p>
        </div>
        <Avatar name={name} />
        <Button size="sm" variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
