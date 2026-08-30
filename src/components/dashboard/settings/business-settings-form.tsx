"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BusinessSettingsForm({
  businessId,
  initial,
  readOnly,
}: {
  businessId: string;
  initial: { name: string; timezone: string; lowStockAlertEmail: boolean; storefrontEnabled: boolean };
  readOnly?: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/business/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save settings");
        return;
      }
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-2">
        <Label>Business name</Label>
        <Input value={form.name} disabled={readOnly} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Timezone</Label>
        <Input value={form.timezone} disabled={readOnly} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.lowStockAlertEmail}
          disabled={readOnly}
          onChange={(e) => setForm({ ...form, lowStockAlertEmail: e.target.checked })}
        />
        Notify me by email on low stock
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.storefrontEnabled}
          disabled={readOnly}
          onChange={(e) => setForm({ ...form, storefrontEnabled: e.target.checked })}
        />
        Storefront enabled
      </label>
      {!readOnly && (
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      )}
    </div>
  );
}
