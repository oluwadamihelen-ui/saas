import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/require";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformSettings } from "@/lib/services/platform-settings";
import { PlatformSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Platform Settings" };

export default async function SuperAdminSettingsPage() {
  await requireSuperAdmin();
  const settings = await getPlatformSettings();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Platform Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformSettingsForm settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
