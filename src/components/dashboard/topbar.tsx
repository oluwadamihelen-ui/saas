"use client";

import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";

export function Topbar({
  userName,
  planName,
  businesses,
  activeBusinessId,
}: {
  userName: string;
  planName?: string;
  businesses: { id: string; name: string }[];
  activeBusinessId: string;
}) {
  const router = useRouter();

  async function switchBusiness(id: string) {
    document.cookie = `mama_active_business=${id}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        {businesses.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">
              {businesses.find((b) => b.id === activeBusinessId)?.name ?? "Select business"}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Your businesses</DropdownMenuLabel>
              {businesses.map((b) => (
                <DropdownMenuItem key={b.id} onClick={() => switchBusiness(b.id)}>
                  {b.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">{businesses[0]?.name}</span>
        )}
        {planName && <Badge variant="secondary">{planName} plan</Badge>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full">
          <Avatar>
            <AvatarFallback>{userName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{userName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>Settings</DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
