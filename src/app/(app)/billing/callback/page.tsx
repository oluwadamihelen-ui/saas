import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getPaymentProvider } from "@/lib/payments";
import { activateFromPayment } from "@/lib/billing";
import { LinkButton, Card } from "@/components/ui";

export default async function BillingCallback({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  const user = await getUser();
  if (!reference) redirect("/billing");
  const found = await prisma.payment.findFirst({ where: { reference, userId: user.id } });
  if (!found) redirect("/billing");
  let p = found;
  if (p.status === "PENDING") {
    // Never trust the browser: ask the processor server-to-server.
    const provider = getPaymentProvider();
    const v = await provider.verify(reference);
    if (v.status === "SUCCEEDED" && v.amount === p.amount && v.currency === p.currency) p = (await activateFromPayment(p.id, { authorizationCode: v.authorizationCode })) ?? p;
    else if (v.status === "FAILED") p = await prisma.payment.update({ where: { id: p.id }, data: { status: "FAILED" } });
  }
  return (
    <Card className="mx-auto mt-16 max-w-md p-8 text-center">
      {p.status === "SUCCEEDED" ? (<><h1 className="text-xl font-semibold">You&apos;re on Pro</h1><p className="mt-2 text-sm text-muted">Thanks! Unlimited trades, advanced analytics and TradingView tools are now unlocked.</p></>)
        : p.status === "FAILED" ? (<><h1 className="text-xl font-semibold">Payment didn&apos;t go through</h1><p className="mt-2 text-sm text-muted">You have not been charged. You can try again.</p></>)
        : (<><h1 className="text-xl font-semibold">Payment pending</h1><p className="mt-2 text-sm text-muted">We are waiting for confirmation from the payment provider. Refresh in a moment.</p></>)}
      <LinkButton href={p.status === "SUCCEEDED" ? "/dashboard" : "/billing"} className="mt-6">{p.status === "SUCCEEDED" ? "Go to dashboard" : "Back to billing"}</LinkButton>
    </Card>
  );
}
