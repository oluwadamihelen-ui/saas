import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, TenantError } from "@/lib/tenant";
import { createUser, createBusinessWithOwner, createProduct } from "./factories";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe("tenant isolation", () => {
  let userA: Awaited<ReturnType<typeof createUser>>;
  let userB: Awaited<ReturnType<typeof createUser>>;
  let businessA: Awaited<ReturnType<typeof createBusinessWithOwner>>;
  let businessB: Awaited<ReturnType<typeof createBusinessWithOwner>>;

  beforeAll(async () => {
    userA = await createUser({ name: "Merchant A" });
    userB = await createUser({ name: "Merchant B" });
    businessA = await createBusinessWithOwner(userA.id, { name: "Business A" });
    businessB = await createBusinessWithOwner(userB.id, { name: "Business B" });
    await createProduct(businessA.id, { name: "A's Rice" });
    await createProduct(businessB.id, { name: "B's Beans" });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.businessMember.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessA.id, businessB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  });

  it("allows a merchant to access their own business", async () => {
    mockAuth.mockResolvedValue({ user: { id: userA.id, isSuspended: false } });
    const membership = await requireBusinessMembership(businessA.id);
    expect(membership.businessId).toBe(businessA.id);
    expect(membership.role).toBe("OWNER");
  });

  it("denies a merchant access to another merchant's business", async () => {
    mockAuth.mockResolvedValue({ user: { id: userA.id, isSuspended: false } });
    await expect(requireBusinessMembership(businessB.id)).rejects.toThrow(TenantError);
    await expect(requireBusinessMembership(businessB.id)).rejects.toMatchObject({ status: 404 });
  });

  it("denies access entirely when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireBusinessMembership(businessA.id)).rejects.toMatchObject({ status: 401 });
  });

  it("denies a suspended user even for their own business", async () => {
    mockAuth.mockResolvedValue({ user: { id: userA.id, isSuspended: true } });
    await expect(requireBusinessMembership(businessA.id)).rejects.toMatchObject({ status: 403 });
  });

  it("never returns another business's products when querying by businessId", async () => {
    const productsForA = await prisma.product.findMany({ where: { businessId: businessA.id } });
    expect(productsForA.every((p) => p.businessId === businessA.id)).toBe(true);
    expect(productsForA.some((p) => p.name === "B's Beans")).toBe(false);
  });
});
