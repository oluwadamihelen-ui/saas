import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { getPortalInviteByToken } from "@/lib/services/portal-invites";
import { AcceptPortalInviteForm } from "./accept-invite-form";

export default async function AcceptPortalInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getPortalInviteByToken(token);

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    notFound();
  }

  const personName =
    invite.type === "GUARDIAN"
      ? `${invite.guardian?.firstName} ${invite.guardian?.lastName}`
      : `${invite.student?.firstName} ${invite.student?.lastName}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8">
        <Logo height={32} />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join {invite.school.name}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to the {invite.type === "GUARDIAN" ? "parent" : "student"} portal as{" "}
            {personName}. Set a password to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptPortalInviteForm
            token={invite.token}
            email={invite.email}
            redirectTo={invite.type === "GUARDIAN" ? "/portal/parent" : "/portal/student"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
