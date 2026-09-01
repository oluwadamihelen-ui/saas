"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet, ShieldCheck } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";

export function Topbar({
  userName,
  planName,
  businesses,
  activeBusinessId,
  walletBalance,
  currency,
  isPlatformAdmin,
}: {
  userName: string;
  planName?: string;
  businesses: { id: string; name: string }[];
  activeBusinessId: string;
  walletBalance: string;
  currency: string;
  isPlatformAdmin: boolean;
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
      <div className="flex items-center gap-3">
        {isPlatformAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Admin panel
          </Link>
        )}
        <Link
          href="/dashboard/wallet"
          className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-sm font-medium hover:bg-secondary"
        >
          <Wallet className="h-3.5 w-3.5 text-primary" />
          {formatCurrency(walletBalance, currency)}
        </Link>
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
      </div>
    </header>
  );
}
