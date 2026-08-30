"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SEGMENTS = [
  { value: "INACTIVE", label: "Inactive customers" },
  { value: "VIP", label: "VIP customers" },
  { value: "RETURNING", label: "Returning customers" },
  { value: "NEW", label: "New customers" },
];

type Campaign = {
  id: string;
  name: string;
  message: string;
  segmentType: string;
  status: string;
  recipients: { id: string; status: string }[];
};

export function MarketingClient({
  businessId,
  businessName,
  initialCampaigns,
}: {
  businessId: string;
  businessName: string;
  initialCampaigns: Campaign[];
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [segment, setSegment] = useState("INACTIVE");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function generateDraft() {
    setGenerating(true);
    try {
      const label = SEGMENTS.find((s) => s.value === segment)?.label ?? "customers";
      const templates: Record<string, string> = {
        INACTIVE: `Hi 👋 We haven't seen you in a while at ${businessName}. Some of your favorite products are back in stock. We'd love to serve you again!`,
        VIP: `Hi 👑 As one of our most valued customers, we wanted to say thank you — enjoy priority service on your next order at ${businessName}.`,
        RETURNING: `Hi! 👋 ${businessName} has new arrivals and great prices this week. Come take a look!`,
        NEW: `Welcome to ${businessName}! 🎉 Thanks for your first order — let us know if there's anything you need.`,
      };
      setMessage(templates[segment] ?? `Hi from ${businessName}!`);
      if (!name) setName(`${label} re-engagement`);
    } finally {
      setGenerating(false);
    }
  }

  async function createCampaign() {
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, name, message, segmentType: segment }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create campaign");
        return;
      }
      setCampaigns((prev) => [data.campaign, ...prev]);
      toast.success(`Campaign created with ${data.campaign.recipients.length} recipients`);
      setName("");
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function sendCampaign(id: string) {
    setSendingId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not send campaign");
        return;
      }
      setCampaigns((prev) => prev.map((c) => (c.id === id ? data.campaign : c)));
      toast.success(`Sent to ${data.sent} customer(s)${data.failed ? `, ${data.failed} failed` : ""}`);
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Win back customers and promote what&apos;s selling — always reviewed before sending.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="font-semibold">New campaign</h2>
          <div className="space-y-2">
            <Label>Target segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Win back inactive customers" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              <Button type="button" variant="ghost" size="sm" onClick={generateDraft} disabled={generating}>
                <Sparkles className="h-3.5 w-3.5" /> Ask Mama to draft this
              </Button>
            </div>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Write your message or generate one with Mama…" />
          </div>
          <Button onClick={createCampaign} disabled={saving || !name || !message}>
            {saving ? "Creating…" : "Save as draft"}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Campaign history</h2>
        {campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns yet." description="Create your first campaign above." />
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{c.name}</p>
                      <Badge variant={c.status === "SENT" ? "success" : "outline"}>{c.status}</Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{c.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.recipients.length} recipients</p>
                  </div>
                  {c.status === "DRAFT" && (
                    <Button size="sm" onClick={() => sendCampaign(c.id)} disabled={sendingId === c.id || c.recipients.length === 0}>
                      <Send className="h-3.5 w-3.5" /> {sendingId === c.id ? "Sending…" : "Send"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
