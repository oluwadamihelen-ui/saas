import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { LicensedTestForm } from "@/components/market/licensed-test";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isLicenseActive } from "@/lib/market/licensing";
import { datasetsLite } from "@/lib/lab/view";

export const metadata: Metadata = { title: "Test in the Lab" };

export default async function LicensedBacktestPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const user = await getUser();
  const license = await prisma.license.findUnique({ where: { userId_listingId: { userId: user.id, listingId } }, include: { listing: { select: { title: true, allowBuyerBacktest: true, status: true } } } });
  if (!license || !isLicenseActive(license, new Date()) || !license.listing.allowBuyerBacktest || license.listing.status !== "APPROVED") notFound();
  return (
    <>
      <PageHeader title={`Test ${license.listing.title}`} subtitle="Run the creator's published strategy on your own candle data. You'll see the results; the strategy's rules stay with the creator." />
      <Card className="p-4 md:p-5"><LicensedTestForm listingId={listingId} datasets={await datasetsLite(user.id)} /></Card>
    </>
  );
}
