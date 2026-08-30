"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WhatsAppSettingsForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: { phoneNumberId: string; wabaId: string; displayPhoneNumber: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...initial, accessToken: "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save");
        return;
      }
      toast.success("WhatsApp settings saved");
      setForm((f) => ({ ...f, accessToken: "" }));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Phone Number ID</Label>
        <Input value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>WhatsApp Business Account ID</Label>
        <Input value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Display phone number</Label>
        <Input value={form.displayPhoneNumber} onChange={(e) => setForm({ ...form, displayPhoneNumber: e.target.value })} placeholder="+234 801 234 5678" />
      </div>
      <div className="space-y-2">
        <Label>Access token</Label>
        <Input type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <Button onClick={save} disabled={saving || !form.phoneNumberId || !form.wabaId || !form.accessToken}>
          {saving ? "Saving…" : "Save connection"}
        </Button>
      </div>
    </div>
  );
}
