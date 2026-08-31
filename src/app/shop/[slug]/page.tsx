import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/current-business";
import { getOrCreateWallet } from "@/lib/wallet";
import { StorefrontClient } from "@/components/storefront/storefront-client";

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      settings: true,
      products: {
        where: { isActive: true },
        include: { category: true },
        orderBy: { createdAt: "desc" },
      },
      productCategories: true,
    },
  });

  if (!business || business.isSuspended || business.settings?.storefrontEnabled === false) {
    notFound();
  }

  // Wallet-pay is only offered to a signed-in MAMA merchant browsing
  // someone else's store — a wallet belongs to a business, not an
  // anonymous storefront customer.
  let viewerWallet: { businessId: string; balance: string; currency: string } | null = null;
  const viewer = await getCurrentBusiness().catch(() => null);
  if (viewer && viewer.business.id !== business.id) {
    const wallet = await getOrCreateWallet(viewer.business.id);
    viewerWallet = { businessId: viewer.business.id, balance: wallet.balance.toString(), currency: wallet.currency };
  }

  return (
    <StorefrontClient
      business={{
        slug: business.slug,
        name: business.name,
        category: business.category,
        currency: business.currency,
        phone: business.phone,
        logoUrl: business.logoUrl,
        coverImageUrl: business.coverImageUrl,
      }}
      categories={business.productCategories.map((c) => ({ id: c.id, name: c.name }))}
      products={JSON.parse(JSON.stringify(business.products))}
      viewerWallet={viewerWallet}
    />
  );
}
