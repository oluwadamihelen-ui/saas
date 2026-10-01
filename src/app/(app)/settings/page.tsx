import type { Metadata } from "next";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { getContext } from "@/lib/session";
import { ProfileForm } from "./profile-form";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, plan } = await getContext();
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-xl p-5"><ProfileForm name={user.name ?? ""} email={user.email} timezone={user.timezone} currency={user.displayCurrency} /></Card>
      <Card className="mt-5 flex max-w-xl items-center justify-between gap-4 p-5">
        <div><div className="text-sm font-semibold">Plan <Badge tone={plan.key === "PRO" ? "up" : "neutral"}>{plan.key}</Badge></div><p className="mt-1 text-xs text-muted">{plan.renewsAt ? `Pro access until ${fmtDate(plan.renewsAt, user.timezone)}` : "Free plan"}</p></div>
        <LinkButton href="/billing" variant="secondary">{plan.key === "PRO" ? "Manage" : "Upgrade"}</LinkButton>
      </Card>
      <p className="mt-6 max-w-xl text-xs text-muted">Account balances, risk rules and instruments are managed per account under Accounts and Risk Rules.</p>
    </>
  );
}
