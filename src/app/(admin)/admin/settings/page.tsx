import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveLegalDocument, saveGeneralSettings, saveDeveloperSettings } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const LEGAL_DOCS = [
  { slug: "terms", label: "Terms of Service" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "refunds", label: "Refund Policy" },
  { slug: "acceptable-use", label: "Acceptable Use Policy" },
];

export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const [generalSetting, developerSetting, ...legalSettings] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "general" } }),
    prisma.setting.findUnique({ where: { key: "developer" } }),
    ...LEGAL_DOCS.map((doc) => prisma.setting.findUnique({ where: { key: `legal.${doc.slug}` } })),
  ]);

  const general = generalSetting?.value as { companyName?: string; supportEmail?: string; currency?: string } | undefined;
  const developer = developerSetting?.value as { commissionRate?: number } | undefined;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveGeneralSettings} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company name</Label>
              <Input id="companyName" name="companyName" defaultValue={general?.companyName ?? "BridgeCodes, Inc."} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supportEmail">Support email</Label>
              <Input id="supportEmail" name="supportEmail" type="email" defaultValue={general?.supportEmail ?? "support@bridgecodes.example"} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Platform currency (ISO 4217)</Label>
              <Input id="currency" name="currency" maxLength={3} minLength={3} className="uppercase" defaultValue={general?.currency ?? "USD"} required />
              <p className="text-xs text-muted">Applies to new pricing and orders. Existing orders keep the currency they were placed in.</p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Developer Marketplace</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveDeveloperSettings} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="commissionRate">Developer commission rate (0–1)</Label>
              <Input id="commissionRate" name="commissionRate" type="number" min={0} max={1} step={0.01} defaultValue={developer?.commissionRate ?? 0.7} required />
              <p className="text-xs text-muted">Share of each direct app-license sale paid to the developer who authored it, e.g. 0.7 for 70%.</p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {LEGAL_DOCS.map((doc, i) => {
        const value = legalSettings[i]?.value as { title?: string; body?: string } | undefined;
        const action = saveLegalDocument.bind(null, doc.slug);
        return (
          <Card key={doc.slug}>
            <CardHeader>
              <CardTitle>{doc.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={action} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`${doc.slug}-title`}>Page title</Label>
                  <Input id={`${doc.slug}-title`} name="title" defaultValue={value?.title ?? doc.label} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${doc.slug}-body`}>Content</Label>
                  <Textarea id={`${doc.slug}-body`} name="body" rows={8} defaultValue={value?.body ?? ""} required />
                </div>
                <Button type="submit" size="sm">
                  Save {doc.label}
                </Button>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
