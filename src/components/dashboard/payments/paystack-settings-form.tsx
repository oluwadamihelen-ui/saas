"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaystackSettingsForm({
  businessId,
  initialPublicKey,
}: {
  businessId: string;
  initialPublicKey: string;
}) {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState(initialPublicKey);
  const [secretKey, setSecretKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/payments/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, paystackPublicKey: publicKey, paystackSecretKey: secretKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save");
        return;
      }
      toast.success("Paystack settings saved");
      setSecretKey("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-2">
        <Label>Public key</Label>
        <Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="pk_test_..." />
      </div>
      <div className="space-y-2">
        <Label>Secret key</Label>
        <Input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="sk_test_..." />
      </div>
      <Button onClick={save} disabled={saving || !publicKey || !secretKey}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
