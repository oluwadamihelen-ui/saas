import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { assertProductLimit } from "@/lib/subscription";
import { TenantError } from "@/lib/errors";
import { createUser, createBusinessWithOwner, createProduct, ensurePlan } from "./factories";

describe("subscription plan limits", () => {
  let business: Awaited<ReturnType<typeof createBusinessWithOwner>>;

  beforeAll(async () => {
    const freePlan = await ensurePlan("FREE", 2);
    const owner = await createUser();
    business = await createBusinessWithOwner(owner.id);
    await prisma.subscription.create({ data: { businessId: business.id, planId: freePlan.id } });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { businessId: business.id } });
    await prisma.subscription.deleteMany({ where: { businessId: business.id } });
    await prisma.businessMember.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
  });

  it("allows adding products under the plan limit", async () => {
    await createProduct(business.id);
    await expect(assertProductLimit(business.id)).resolves.toBeUndefined();
  });

  it("blocks adding a product once the plan limit is reached", async () => {
    await createProduct(business.id);
    // Business now has 2 products, matching the FREE plan's limit of 2.
    await expect(assertProductLimit(business.id)).rejects.toThrow(TenantError);
    await expect(assertProductLimit(business.id)).rejects.toMatchObject({ status: 402 });
  });
});
