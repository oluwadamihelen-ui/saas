import { redirect } from "next/navigation";
import { Card, LinkButton } from "@/components/ui";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getProviderByName } from "@/lib/payments";
import { fulfillVerified } from "@/lib/market/orders";

export const dynamic = "force-dynamic";

export default async function MarketCallback({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  const user = await getUser();
  if (!reference) redirect("/market");
  let order = await prisma.marketOrder.findFirst({ where: { reference, buyerId: user.id }, include: { listing: { select: { slug: true, title: true } } } });
  if (!order) redirect("/market");
  if (order.status === "PENDING") {
    // Never trust the browser: ask the processor server-to-server, and check amount + currency against our order.
    const v = await getProviderByName(order.provider).verify(reference);
    if (v.status === "SUCCEEDED" && v.amount !== undefined && v.currency) {
      await fulfillVerified(reference, { amountMinor: Math.round(v.amount * 100), currency: v.currency });
      order = await prisma.marketOrder.findFirstOrThrow({ where: { reference, buyerId: user.id }, include: { listing: { select: { slug: true, title: true } } } });
    } else if (v.status === "FAILED") {
      order = await prisma.marketOrder.update({ where: { id: order.id }, data: { status: "FAILED" }, include: { listing: { select: { slug: true, title: true } } } });
    }
  }
  const paid = order.status === "PAID";
  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center">
      {paid ? <><h1 className="text-xl font-semibold">You now have access</h1><p className="mt-2 text-sm text-muted">{order.listing.title} is in My Indicators.</p></>
        : order.status === "FAILED" ? <><h1 className="text-xl font-semibold">Payment didn&apos;t go through</h1><p className="mt-2 text-sm text-muted">You have not been charged. You can try again.</p></>
        : order.status === "REFUNDED" ? <h1 className="text-xl font-semibold">This order was refunded</h1>
        : <><h1 className="text-xl font-semibold">Payment pending</h1><p className="mt-2 text-sm text-muted">We are waiting for confirmation from the payment provider. Refresh in a moment.</p></>}
      <LinkButton href={paid ? "/library" : `/market/${order.listing.slug}`} className="mt-6">{paid ? "Open My Indicators" : "Back to the product"}</LinkButton>
    </Card>
  );
}
