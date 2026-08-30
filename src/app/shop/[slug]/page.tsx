import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
    />
  );
}
