import { prisma } from "@/lib/db";

export interface CouponValidation {
  valid: boolean;
  couponId?: string;
  discount?: number;
  error?: string;
}

/**
 * Checks a coupon code against a subtotal without applying it -- the write
 * side (incrementing usedCount) only happens once a payment actually
 * clears, in incrementCouponUsage, so an abandoned/unpaid order never
 * consumes a redemption.
 */
export async function validateCoupon(code: string, subtotal: number): Promise<CouponValidation> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) return { valid: false, error: "Coupon not found" };
  if (!coupon.isActive) return { valid: false, error: "This coupon is no longer active" };

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) return { valid: false, error: "This coupon isn't active yet" };
  if (coupon.expiresAt && now > coupon.expiresAt) return { valid: false, error: "This coupon has expired" };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { valid: false, error: "This coupon has reached its usage limit" };

  const rawDiscount = coupon.type === "PERCENT" ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);
  const discount = Math.min(Math.round(rawDiscount * 100) / 100, subtotal);

  return { valid: true, couponId: coupon.id, discount };
}

export async function incrementCouponUsage(couponId: string) {
  await prisma.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
}
