import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { setBundleActiveAdmin } from "./actions";

export const metadata: Metadata = { title: "Bundles" };

export default async function AdminBundlesPage() {
  await requirePermission(PERMISSIONS.COUPONS_MANAGE);

  const bundles = await prisma.bundle.findMany({ orderBy: { createdAt: "desc" }, include: { items: true } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bundles</h1>
        <Button asChild size="sm">
          <Link href="/admin/bundles/new">New Bundle</Link>
        </Button>
      </div>

      {bundles.length === 0 ? (
        <EmptyState title="No bundles yet" description="Create a bundle to sell multiple apps, hosting, or services at one flat price." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bundles.map((bundle) => {
                const toggleActive = setBundleActiveAdmin.bind(null, bundle.id, !bundle.isActive);
                return (
                  <tr key={bundle.id} className="hover:bg-muted-surface">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`/admin/bundles/${bundle.id}`} className="hover:text-accent hover:underline">
                        {bundle.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{bundle.items.length} item{bundle.items.length === 1 ? "" : "s"}</td>
                    <td className="px-4 py-3 text-muted">{formatCurrency(Number(bundle.price), bundle.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bundle.isActive ? "bg-success-soft text-success" : "bg-muted-surface text-muted"}`}>
                        {bundle.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={toggleActive}>
                        <Button type="submit" size="sm" variant="ghost">
                          {bundle.isActive ? "Deactivate" : "Activate"}
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
