"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Provider = "META" | "TWILIO";

const FIELD_LABELS: Record<Provider, { phoneNumberId: string; wabaId: string; accessToken: string; help: string }> = {
  META: {
    phoneNumberId: "Phone Number ID",
    wabaId: "WhatsApp Business Account ID",
    accessToken: "Access token",
    help: "From Meta for Developers → your app → WhatsApp → API Setup.",
  },
  TWILIO: {
    phoneNumberId: "Twilio WhatsApp number",
    wabaId: "Twilio Account SID",
    accessToken: "Twilio Auth Token",
    help: "From your Twilio Console. Use the sandbox number to test, or a production WhatsApp sender once approved.",
  },
};

export function WhatsAppSettingsForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: { provider?: Provider; phoneNumberId: string; wabaId: string; displayPhoneNumber: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState({ provider: initial.provider ?? "META", ...initial, accessToken: "" });
  const [saving, setSaving] = useState(false);
  const labels = FIELD_LABELS[form.provider as Provider];

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
    <div className="mt-4 space-y-4">
      <div className="max-w-xs space-y-2">
        <Label>Provider</Label>
        <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v as Provider })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="META">Meta WhatsApp Cloud API</SelectItem>
            <SelectItem value="TWILIO">Twilio</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{labels.help}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{labels.phoneNumberId}</Label>
          <Input value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder={form.provider === "TWILIO" ? "+14155238886" : undefined} />
        </div>
        <div className="space-y-2">
          <Label>{labels.wabaId}</Label>
          <Input value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Display phone number</Label>
          <Input value={form.displayPhoneNumber} onChange={(e) => setForm({ ...form, displayPhoneNumber: e.target.value })} placeholder="+234 801 234 5678" />
        </div>
        <div className="space-y-2">
          <Label>{labels.accessToken}</Label>
          <Input type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={save} disabled={saving || !form.phoneNumberId || !form.wabaId || !form.accessToken}>
            {saving ? "Saving…" : "Save connection"}
          </Button>
        </div>
      </div>
    </div>
  );
}
