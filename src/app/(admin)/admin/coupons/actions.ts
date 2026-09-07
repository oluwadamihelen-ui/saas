"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/security/audit";

const createCouponSchema = z.object({
  code: z.string().trim().min(3).max(50).toUpperCase(),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().positive(),
  maxUses: z.coerce.number().int().positive().optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

export interface CouponFormState {
  status: "idle" | "error";
  message?: string;
}

export async function createCoupon(_prev: CouponFormState, formData: FormData): Promise<CouponFormState> {
  const admin = await requirePermission(PERMISSIONS.COUPONS_MANAGE);

  const parsed = createCouponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    maxUses: formData.get("maxUses") || undefined,
    startsAt: formData.get("startsAt") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the coupon fields." };
  }
  if (parsed.data.type === "PERCENT" && parsed.data.value > 100) {
    return { status: "error", message: "A percentage discount can't exceed 100." };
  }

  const existing = await prisma.coupon.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return { status: "error", message: `Coupon code ${parsed.data.code} already exists.` };
  }

  const coupon = await prisma.coupon.create({
    data: {
      code: parsed.data.code,
      type: parsed.data.type,
      value: parsed.data.value,
      maxUses: parsed.data.maxUses,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    },
  });

  await recordAuditLog({
    actorId: admin.id,
    action: "coupon.created",
    resourceType: "Coupon",
    resourceId: coupon.id,
    newValue: { code: coupon.code, type: coupon.type, value: Number(coupon.value) },
  });

  redirect("/admin/coupons");
}

export async function setCouponActive(couponId: string, isActive: boolean) {
  const admin = await requirePermission(PERMISSIONS.COUPONS_MANAGE);
  await prisma.coupon.update({ where: { id: couponId }, data: { isActive } });
  await recordAuditLog({ actorId: admin.id, action: isActive ? "coupon.enabled" : "coupon.disabled", resourceType: "Coupon", resourceId: couponId });
  revalidatePath("/admin/coupons");
}
