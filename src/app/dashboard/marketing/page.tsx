import { getCurrentBusiness } from "@/lib/current-business";
import { prisma } from "@/lib/prisma";
import { MarketingClient } from "@/components/dashboard/marketing/marketing-client";

export default async function MarketingPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;

  const campaigns = await prisma.campaign.findMany({
    where: { businessId: current.business.id },
    include: { recipients: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <MarketingClient
      businessId={current.business.id}
      businessName={current.business.name}
      initialCampaigns={JSON.parse(JSON.stringify(campaigns))}
    />
  );
}
