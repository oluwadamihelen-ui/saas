import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getSchool } from "@/lib/services/school";
import { listGatewayCredentials } from "@/lib/services/payment-gateways";
import { listNotificationProviderCredentials } from "@/lib/services/notification-delivery";
import { EMAIL_PROVIDERS, SMS_PROVIDERS } from "@/lib/notification-delivery/registry";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./settings-form";
import { BrandingForm } from "./branding-form";
import { ReportCardDesignForm } from "./report-card-design-form";
import { GatewayForm } from "./payment-gateway-form";
import { ActiveProviderForm } from "./active-provider-form";
import { MyProfileForm } from "./my-profile-form";
import { ThresholdsForm } from "./thresholds-form";
import { NotificationProviderForm } from "./notification-provider-form";
import { ActiveEmailProviderForm, ActiveSmsProviderForm } from "./active-notification-provider-form";

const ALL_PROVIDERS = ["PAYSTACK", "FLUTTERWAVE", "KORAPAY"] as const;

export default async function SettingsPage() {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);
  const canManageGateways = perms.has(PERMISSIONS.PAYMENT_GATEWAYS_MANAGE);
  const canManageNotificationProviders = perms.has(PERMISSIONS.NOTIFICATION_PROVIDERS_MANAGE);

  const [school, credentials, notificationCredentials, me, studentCount] = await Promise.all([
    getSchool(user.schoolId),
    canManageGateways ? listGatewayCredentials(user.schoolId) : Promise.resolve([]),
    canManageNotificationProviders ? listNotificationProviderCredentials(user.schoolId) : Promise.resolve([]),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { dateOfBirth: true } }),
    prisma.student.count({ where: { schoolId: user.schoolId } }),
  ]);
  const credentialByProvider = new Map(credentials.map((c) => [c.provider, c]));
  const notificationCredentialByProvider = new Map(notificationCredentials.map((c) => [c.provider, c]));

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
          <SettingsForm school={school} studentCount={studentCount} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thresholds & risk settings</CardTitle>
          <CardDescription>
            The numbers behind expense approvals, Student Performance Analysis and the School Health Score. Sensible
            defaults are already applied — change them only if your school needs different limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThresholdsForm
            currency={school.currency}
            expenseApprovalThresholdMinor={school.expenseApprovalThresholdMinor}
            performancePassMark={school.performancePassMark}
            performanceSignificantChangePoints={school.performanceSignificantChangePoints}
            attendanceConcernThreshold={school.attendanceConcernThreshold}
            performanceFailedSubjectConcernThreshold={school.performanceFailedSubjectConcernThreshold}
            healthScoreWeightAcademic={school.healthScoreWeightAcademic}
            healthScoreWeightAttendance={school.healthScoreWeightAttendance}
            healthScoreWeightFinancial={school.healthScoreWeightFinancial}
            healthScoreWeightOperational={school.healthScoreWeightOperational}
          />
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

      <Card>
        <CardHeader>
          <CardTitle>Report card design</CardTitle>
          <CardDescription>
            Upload a header, watermark and signature once and every report card a parent or student downloads from
            this school uses them automatically — no need to redesign anything per term.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportCardDesignForm
            school={{
              reportCardHeaderUrl: school.reportCardHeaderUrl,
              reportCardWatermarkUrl: school.reportCardWatermarkUrl,
              reportCardSignatureUrl: school.reportCardSignatureUrl,
              reportCardFooterText: school.reportCardFooterText,
            }}
          />
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

      {canManageNotificationProviders && (
        <Card>
          <CardHeader>
            <CardTitle>Email & SMS delivery</CardTitle>
            <CardDescription>
              Connect Resend for email and Twilio and/or Sent.dm for SMS so staff, parents and students who opt in
              (Notifications → Preferences) receive email/SMS copies, not just in-app ones. Until you connect a
              provider for a channel, that channel&apos;s sends are simply skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationCredentials.some((c) => EMAIL_PROVIDERS.includes(c.provider)) && (
              <ActiveEmailProviderForm
                currentProvider={school.activeEmailProvider}
                connectedProviders={notificationCredentials.filter((c) => c.isEnabled && EMAIL_PROVIDERS.includes(c.provider)).map((c) => c.provider)}
              />
            )}
            {notificationCredentials.some((c) => SMS_PROVIDERS.includes(c.provider)) && (
              <ActiveSmsProviderForm
                currentProvider={school.activeSmsProvider}
                connectedProviders={notificationCredentials.filter((c) => c.isEnabled && SMS_PROVIDERS.includes(c.provider)).map((c) => c.provider)}
              />
            )}
            {[...EMAIL_PROVIDERS, ...SMS_PROVIDERS].map((p) => {
              const c = notificationCredentialByProvider.get(p);
              return (
                <NotificationProviderForm
                  key={p}
                  provider={p}
                  connected={c ? { fromIdentifier: c.fromIdentifier, isEnabled: c.isEnabled, hasAccountSid: Boolean(c.accountSidEnc) } : null}
                />
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
