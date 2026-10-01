import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { CreatorProfileForm } from "@/components/market/creator-forms";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Creator profile" };

export default async function CreatorProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getUser();
  const c = await prisma.creator.findUnique({ where: { userId: user.id } });
  return (
    <>
      <PageHeader title={c ? "Creator profile" : "Become a creator"} subtitle="Sell indicators and strategies on the RiskPilot marketplace. You set the price; the platform takes a commission on sales." />
      <Card className="max-w-xl p-5"><CreatorProfileForm initial={c ? { displayName: c.displayName, bio: c.bio, website: c.website } : undefined} next={next} /></Card>
    </>
  );
}
