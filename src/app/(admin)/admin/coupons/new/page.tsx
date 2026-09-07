import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CouponForm } from "./coupon-form";

export const metadata: Metadata = { title: "New Coupon" };

export default async function NewCouponPage() {
  await requirePermission(PERMISSIONS.COUPONS_MANAGE);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add Coupon</h1>
      <CouponForm />
    </div>
  );
}
