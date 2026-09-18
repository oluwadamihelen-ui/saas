"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";

export function SignOutButton() {
  const signOut = useSignOut();
  return (
    <Button size="sm" variant="ghost" onClick={signOut}>
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
