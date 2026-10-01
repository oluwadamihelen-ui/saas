import { redirect } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { mockPayAction } from "@/actions/billing";
import { getPaymentProvider } from "@/lib/payments";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { money } from "@/lib/utils";

export default async function MockPay({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  const user = await getUser();
  if (getPaymentProvider().name !== "mock" || !reference) redirect("/billing");
  const p = reference.startsWith("mp_")
    ? await prisma.marketOrder.findFirst({ where: { reference, buyerId: user.id } }).then((o) => (o ? { amount: o.chargeMinor / 100, currency: o.currency } : null))
    : await prisma.payment.findFirst({ where: { reference, userId: user.id } });
  if (!p) redirect("/billing");
  return (
    <Card className="mx-auto mt-16 max-w-md p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-warn">Test payment — no real money</p>
      <h1 className="mt-2 text-xl font-semibold">Pay {money(p.amount, p.currency, { decimals: p.currency === "NGN" ? 0 : 2 })}</h1>
      <p className="mt-2 text-sm text-muted">This is the development payment provider. Set PAYMENT_PROVIDER=paystack for real checkout.</p>
      <form action={mockPayAction} className="mt-6"><input type="hidden" name="reference" value={reference} /><Button className="w-full" size="lg">Simulate successful payment</Button></form>
    </Card>
  );
}
