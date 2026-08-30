"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BusinessSuspendToggle({ businessId, isSuspended }: { businessId: string; isSuspended: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!confirm(isSuspended ? "Reactivate this business?" : "Suspend this business? They will lose access immediately.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuspended: !isSuspended }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not update business");
        return;
      }
      toast.success(isSuspended ? "Business reactivated" : "Business suspended");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant={isSuspended ? "outline" : "destructive"} onClick={toggle} disabled={loading}>
      {isSuspended ? "Reactivate" : "Suspend"}
    </Button>
  );
}
