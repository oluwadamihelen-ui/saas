"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { resolveHotelSwitch } from "@/lib/auth/hotel";

export interface HotelOption {
  hotelId: string;
  hotelName: string;
}

export function HotelTopbar({
  name,
  email,
  hotelName,
  role,
  unreadCount,
  hotelOptions,
}: {
  name: string;
  email: string;
  hotelName: string | null;
  role: string;
  unreadCount: number;
  hotelOptions: HotelOption[];
}) {
  const { update } = useSession();
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSwitch(hotelId: string) {
    startTransition(async () => {
      try {
        const result = await resolveHotelSwitch(hotelId);
        await update(result);
        setSwitcherOpen(false);
        router.push("/app");
        router.refresh();
      } catch {
        setSwitcherOpen(false);
      }
    });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-2">
        {hotelOptions.length > 1 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-foreground hover:bg-muted-surface"
            >
              {hotelName ?? "Select hotel"}
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
            {switcherOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-surface py-1 shadow-lg">
                {hotelOptions.map((opt) => (
                  <button
                    key={opt.hotelId}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSwitch(opt.hotelId)}
                    className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted-surface disabled:opacity-50"
                  >
                    {opt.hotelName}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm font-semibold text-foreground">{hotelName}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Link href="/app/notifications" className="relative rounded-md p-2 text-muted hover:bg-muted-surface hover:text-foreground">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted">
            {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role} · {email}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
