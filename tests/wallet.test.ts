import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creditWallet, debitWallet, transferBetweenWallets, getOrCreateWallet } from "@/lib/wallet";
import { TenantError } from "@/lib/errors";
import { createUser, createBusinessWithOwner, createProduct } from "./factories";
import { createOrder } from "@/lib/orders";

describe("wallet ledger", () => {
  let businessA: Awaited<ReturnType<typeof createBusinessWithOwner>>;
  let businessB: Awaited<ReturnType<typeof createBusinessWithOwner>>;
  let testOrderId: string;

  beforeAll(async () => {
    const ownerA = await createUser();
    const ownerB = await createUser();
    businessA = await createBusinessWithOwner(ownerA.id, { name: "Wallet Test A" });
    businessB = await createBusinessWithOwner(ownerB.id, { name: "Wallet Test B" });

    // A real order is needed for WalletTransaction.orderId's foreign key —
    // its contents don't matter for these ledger-mechanics tests.
    const product = await createProduct(businessA.id, { name: "Wallet test product", price: 4000, stockQuantity: 100 });
    const order = await createOrder({
      businessId: businessA.id,
      customerPhone: "+2348033333333",
      items: [{ productId: product.id, quantity: 1 }],
      source: "DASHBOARD",
    });
    testOrderId = order.id;
  });

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({ where: { wallet: { businessId: { in: [businessA.id, businessB.id] } } } });
    await prisma.wallet.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.orderItem.deleteMany({ where: { order: { businessId: businessA.id } } });
    await prisma.order.deleteMany({ where: { businessId: businessA.id } });
    await prisma.product.deleteMany({ where: { businessId: businessA.id } });
    await prisma.businessMember.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessA.id, businessB.id] } } });
  });

  it("credits a wallet and writes a matching ledger row", async () => {
    const updated = await creditWallet(businessA.id, 5000, "SALE_CREDIT", { description: "Test sale" });
    expect(updated.balance.toString()).toBe("5000");

    const rows = await prisma.walletTransaction.findMany({ where: { walletId: updated.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("SALE_CREDIT");
    expect(rows[0].balanceAfter.toString()).toBe("5000");
  });

  it("rejects a debit larger than the balance, leaving the balance untouched", async () => {
    await expect(debitWallet(businessA.id, 999_999, "WITHDRAWAL")).rejects.toThrow(TenantError);
    await expect(debitWallet(businessA.id, 999_999, "WITHDRAWAL")).rejects.toMatchObject({ status: 402 });

    const wallet = await getOrCreateWallet(businessA.id);
    expect(wallet.balance.toString()).toBe("5000"); // unchanged
  });

  it("debits a wallet when balance is sufficient", async () => {
    const updated = await debitWallet(businessA.id, 2000, "WITHDRAWAL", { description: "Test withdrawal" });
    expect(updated.balance.toString()).toBe("3000");
  });

  it("never allows two concurrent debits to both succeed past the balance", async () => {
    // Balance is 3000. Fire two debits of 2000 each concurrently — at most one can succeed.
    const results = await Promise.allSettled([
      debitWallet(businessA.id, 2000, "WITHDRAWAL"),
      debitWallet(businessA.id, 2000, "WITHDRAWAL"),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const wallet = await getOrCreateWallet(businessA.id);
    expect(wallet.balance.toString()).toBe("1000"); // 3000 - 2000, never negative
  });

  it("transfers balance between two businesses atomically", async () => {
    await creditWallet(businessB.id, 10_000, "SALE_CREDIT");

    await transferBetweenWallets(businessB.id, businessA.id, 4000, testOrderId);

    const walletA = await getOrCreateWallet(businessA.id);
    const walletB = await getOrCreateWallet(businessB.id);
    expect(walletA.balance.toString()).toBe("5000"); // 1000 + 4000
    expect(walletB.balance.toString()).toBe("6000"); // 10000 - 4000
  });

  it("rejects a wallet-to-wallet transfer that exceeds the buyer's balance", async () => {
    await expect(transferBetweenWallets(businessA.id, businessB.id, 999_999, testOrderId)).rejects.toMatchObject({
      status: 402,
    });
  });

  it("rejects paying yourself from your own wallet", async () => {
    await expect(transferBetweenWallets(businessA.id, businessA.id, 100, testOrderId)).rejects.toThrow(
      "Cannot pay yourself"
    );
  });
});
