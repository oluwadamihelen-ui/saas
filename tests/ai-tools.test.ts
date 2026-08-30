import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getTool } from "@/lib/ai/tools";
import { createUser, createBusinessWithOwner, createProduct } from "./factories";

describe("Mama AI tool scoping", () => {
  let businessA: Awaited<ReturnType<typeof createBusinessWithOwner>>;
  let businessB: Awaited<ReturnType<typeof createBusinessWithOwner>>;

  beforeAll(async () => {
    const ownerA = await createUser();
    const ownerB = await createUser();
    businessA = await createBusinessWithOwner(ownerA.id, { name: "AI Test Business A" });
    businessB = await createBusinessWithOwner(ownerB.id, { name: "AI Test Business B" });
    await createProduct(businessA.id, { name: "A-only low stock item", stockQuantity: 1, lowStockThreshold: 10 });
    await createProduct(businessB.id, { name: "B-only low stock item", stockQuantity: 1, lowStockThreshold: 10 });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.businessMember.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessA.id, businessB.id] } } });
  });

  it("get_low_stock_products only returns the calling business's products", async () => {
    const tool = getTool("get_low_stock_products")!;
    const resultForA = (await tool.handler(businessA.id, {} as never)) as Array<{ name: string }>;
    expect(resultForA.some((p) => p.name === "A-only low stock item")).toBe(true);
    expect(resultForA.some((p) => p.name === "B-only low stock item")).toBe(false);
  });

  it("delete_product is marked destructive and requires confirmation upstream", () => {
    const tool = getTool("delete_product")!;
    expect(tool.destructive).toBe(true);
  });

  it("delete_product only ever matches products within the given business", async () => {
    const tool = getTool("delete_product")!;
    const result = (await tool.handler(businessA.id, { productName: "B-only low stock item" } as never)) as { error?: string };
    expect(result.error).toBe("Product not found");

    const stillExists = await prisma.product.findFirst({ where: { businessId: businessB.id, name: "B-only low stock item" } });
    expect(stillExists).not.toBeNull();
  });
});
