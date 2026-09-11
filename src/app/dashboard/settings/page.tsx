import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getSchool } from "@/lib/services/school";
import { listGatewayCredentials } from "@/lib/services/payment-gateways";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./settings-form";
import { BrandingForm } from "./branding-form";
import { GatewayForm } from "./payment-gateway-form";
import { ActiveProviderForm } from "./active-provider-form";
import { MyProfileForm } from "./my-profile-form";

const ALL_PROVIDERS = ["PAYSTACK", "FLUTTERWAVE", "KORAPAY"] as const;

export default async function SettingsPage() {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  const canManageGateways = perms.has(PERMISSIONS.PAYMENT_GATEWAYS_MANAGE);

  const [school, credentials, me] = await Promise.all([
    getSchool(user.schoolId),
    canManageGateways ? listGatewayCredentials(user.schoolId) : Promise.resolve([]),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { dateOfBirth: true } }),
  ]);
  const credentialByProvider = new Map(credentials.map((c) => [c.provider, c]));

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted">School profile, branding and payment gateways.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My profile</CardTitle>
          <CardDescription>Personal to your own account — unlike everything else on this page, this isn&apos;t visible or editable by other staff.</CardDescription>
        </CardHeader>
        <CardContent>
          <MyProfileForm dateOfBirth={me.dateOfBirth ? me.dateOfBirth.toISOString().slice(0, 10) : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School profile</CardTitle>
          <CardDescription>Shown on report cards, invoices and parent communication.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm school={school} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Make your dashboard and public pages look like your school, not ours.</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingForm school={{ name: school.name, logoUrl: school.logoUrl, brandColor: school.brandColor }} />
        </CardContent>
      </Card>

      {canManageGateways && (
        <Card>
          <CardHeader>
            <CardTitle>Online payment gateways</CardTitle>
            <CardDescription>
              Connect your own Paystack, Flutterwave or Korapay account to collect school fees and admission fees directly.
              Until you connect one, &quot;Pay online&quot; runs a simulated demo payment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {credentials.length > 0 && (
              <ActiveProviderForm
                currentProvider={school.activePaymentProvider}
                connectedProviders={credentials.filter((c) => c.isEnabled).map((c) => c.provider)}
              />
            )}
            {ALL_PROVIDERS.map((p) => {
              const c = credentialByProvider.get(p);
              return (
                <GatewayForm
                  key={p}
                  provider={p}
                  connected={c ? { publicKey: c.publicKey, isEnabled: c.isEnabled, hasWebhookSecret: Boolean(c.webhookSecretEnc) } : null}
                />
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
