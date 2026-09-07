"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

export function DashboardTopbar({ name, email, roleName }: { name: string; email: string; roleName: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
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
