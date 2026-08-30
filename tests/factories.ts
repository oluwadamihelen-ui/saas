import { prisma } from "@/lib/prisma";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createUser(overrides: Partial<{ email: string; name: string }> = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `${unique("user")}@test.mama.dev`,
      name: overrides.name ?? "Test User",
      passwordHash: "irrelevant-for-tests",
    },
  });
}

export async function createBusinessWithOwner(ownerId: string, overrides: Partial<{ name: string }> = {}) {
  const slug = unique("biz");
  return prisma.business.create({
    data: {
      name: overrides.name ?? "Test Business",
      slug,
      ownerName: "Test Owner",
      phone: "+2348000000000",
      email: `${slug}@test.mama.dev`,
      category: "Food",
      members: { create: { userId: ownerId, role: "OWNER" } },
    },
  });
}

export async function createProduct(businessId: string, overrides: Partial<{ name: string; price: number; stockQuantity: number; lowStockThreshold: number }> = {}) {
  return prisma.product.create({
    data: {
      businessId,
      name: overrides.name ?? unique("Product"),
      price: overrides.price ?? 1000,
      stockQuantity: overrides.stockQuantity ?? 10,
      lowStockThreshold: overrides.lowStockThreshold ?? 5,
    },
  });
}

export async function ensurePlan(key: "FREE" | "GROWTH" | "PRO", productLimit: number | null) {
  return prisma.plan.upsert({
    where: { key },
    create: { key, name: key, priceMonthly: 0, productLimit, features: [] },
    update: { productLimit },
  });
}
