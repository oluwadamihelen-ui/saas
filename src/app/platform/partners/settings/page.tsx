import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth/require";
import { getPartnerCommissionConfig } from "@/lib/services/partner-commissions";
import { CommissionConfigForm } from "./config-form";

export const metadata: Metadata = { title: "Partner commission settings" };

export default async function PlatformPartnerSettingsPage() {
  await requireSuperAdmin();
  const config = await getPartnerCommissionConfig();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/platform/partners">&larr; Partners</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Partner commission settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default rates and policies</CardTitle>
          <CardDescription>Applied to every new commercial agreement and referral from now on.</CardDescription>
        </CardHeader>
        <CardContent>
          <CommissionConfigForm config={config} />
        </CardContent>
      </Card>
    </div>
  );
}
