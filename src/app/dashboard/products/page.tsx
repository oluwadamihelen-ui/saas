import { getCurrentBusiness } from "@/lib/current-business";
import { prisma } from "@/lib/prisma";
import { ProductsClient } from "@/components/dashboard/products/products-client";

export default async function ProductsPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;

  const products = await prisma.product.findMany({
    where: { businessId: current.business.id },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ProductsClient
      businessId={current.business.id}
      currency={current.business.currency}
      initialProducts={JSON.parse(JSON.stringify(products))}
    />
  );
}
