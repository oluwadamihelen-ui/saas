import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { setCouponActive } from "./actions";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  await requirePermission(PERMISSIONS.COUPONS_MANAGE);
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
        <Button asChild size="sm">
          <Link href="/admin/coupons/new">Add Coupon</Link>
        </Button>
      </div>

      {coupons.length === 0 ? (
        <EmptyState title="No coupons yet" description="Create a coupon to offer a percentage or fixed discount at checkout." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coupons.map((coupon) => {
                const toggle = setCouponActive.bind(null, coupon.id, !coupon.isActive);
                return (
                  <tr key={coupon.id} className="hover:bg-muted-surface">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{coupon.code}</td>
                    <td className="px-4 py-3 text-muted">{coupon.type === "PERCENT" ? `${Number(coupon.value)}%` : `$${Number(coupon.value).toFixed(2)}`}</td>
                    <td className="px-4 py-3 text-muted">
                      {coupon.usedCount}
                      {coupon.maxUses ? ` / ${coupon.maxUses}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {coupon.startsAt ? formatDate(coupon.startsAt) : "—"} – {coupon.expiresAt ? formatDate(coupon.expiresAt) : "no expiry"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={coupon.isActive ? "text-success" : "text-muted"}>{coupon.isActive ? "Active" : "Disabled"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={toggle}>
                        <Button size="sm" variant="ghost" type="submit">
                          {coupon.isActive ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
