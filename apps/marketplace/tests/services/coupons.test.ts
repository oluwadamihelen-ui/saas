import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { validateCoupon, incrementCouponUsage } from "@/lib/services/coupons";

const SUFFIX = `CPN${Date.now()}`;
const codes: string[] = [];

function trackedCode(label: string) {
  const code = `${SUFFIX}${label}`;
  codes.push(code);
  return code;
}

describe("coupon validation", () => {
  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { code: { in: codes } } });
  });

  it("computes a percent discount off the subtotal", async () => {
    const code = trackedCode("PCT");
    await prisma.coupon.create({ data: { code, type: "PERCENT", value: 10, isActive: true } });
    const result = await validateCoupon(code, 200);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(20);
  });

  it("computes a fixed discount, capped at the subtotal so a coupon can never make the total negative", async () => {
    const code = trackedCode("FIXED");
    await prisma.coupon.create({ data: { code, type: "FIXED", value: 50, isActive: true } });
    const result = await validateCoupon(code, 30);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(30);
  });

  it("is case-insensitive and trims whitespace", async () => {
    const code = trackedCode("CASE");
    await prisma.coupon.create({ data: { code, type: "PERCENT", value: 5, isActive: true } });
    const result = await validateCoupon(`  ${code.toLowerCase()}  `, 100);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(5);
  });

  it("rejects an unknown code", async () => {
    const result = await validateCoupon(`${SUFFIX}NOPE`, 100);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("rejects an inactive coupon", async () => {
    const code = trackedCode("INACTIVE");
    await prisma.coupon.create({ data: { code, type: "PERCENT", value: 10, isActive: false } });
    const result = await validateCoupon(code, 100);
    expect(result.valid).toBe(false);
  });

  it("rejects a coupon that hasn't started yet", async () => {
    const code = trackedCode("FUTURE");
    await prisma.coupon.create({ data: { code, type: "PERCENT", value: 10, isActive: true, startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    const result = await validateCoupon(code, 100);
    expect(result.valid).toBe(false);
  });

  it("rejects an expired coupon", async () => {
    const code = trackedCode("EXPIRED");
    await prisma.coupon.create({ data: { code, type: "PERCENT", value: 10, isActive: true, expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    const result = await validateCoupon(code, 100);
    expect(result.valid).toBe(false);
  });

  it("rejects a coupon that has reached its usage limit", async () => {
    const code = trackedCode("MAXED");
    await prisma.coupon.create({ data: { code, type: "PERCENT", value: 10, isActive: true, maxUses: 1, usedCount: 1 } });
    const result = await validateCoupon(code, 100);
    expect(result.valid).toBe(false);
  });

  it("increments the usage counter", async () => {
    const code = trackedCode("INCR");
    const coupon = await prisma.coupon.create({ data: { code, type: "PERCENT", value: 10, isActive: true } });
    await incrementCouponUsage(coupon.id);
    const updated = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(updated.usedCount).toBe(1);
  });
});
