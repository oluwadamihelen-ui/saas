import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { getInviteByToken } from "@/lib/services/staff";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    notFound();
  }

  const isPasswordSetup = invite.purpose === "PASSWORD_SETUP";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8"><Logo height={32} /></div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isPasswordSetup ? `Set up your ${invite.school.name} password` : `Join ${invite.school.name}`}</CardTitle>
          <CardDescription>
            {isPasswordSetup
              ? `Your ${invite.role.name} account is ready — choose a password to activate it.`
              : `You've been invited as ${invite.role.name}. Set a password to activate your account.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm token={invite.token} email={invite.email} name={invite.user?.name ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
