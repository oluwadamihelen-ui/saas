"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PayoutRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function approve() {
    if (!confirm("Approve this payout account change? Only do this after verifying the merchant's identity directly (e.g. by phone).")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payout-requests/${requestId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not approve this request");
        return;
      }
      toast.success("Payout account updated");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    const note = prompt("Reason for declining (shown to the merchant):") ?? undefined;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payout-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not decline this request");
        return;
      }
      toast.success("Request declined");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" onClick={reject} disabled={loading}>
        Decline
      </Button>
      <Button size="sm" onClick={approve} disabled={loading}>
        Approve
      </Button>
    </div>
  );
}
