import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Star } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { setApplicationStatus, toggleFeatured } from "./actions";

export const metadata: Metadata = { title: "Applications" };

export default async function AdminApplicationsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);

  const applications = await prisma.application.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true, pricing: { where: { type: "LICENSE" }, take: 1 } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <Button asChild size="sm">
          <Link href="/admin/applications/new">
            <Plus className="h-4 w-4" /> Add Application
          </Link>
        </Button>
      </div>

      {applications.length === 0 ? (
        <EmptyState title="No applications yet" description="Add your first application to start selling." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Featured</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${app.id}`} className="font-medium text-accent">
                      {app.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{app.category.name}</td>
                  <td className="px-4 py-3">{app.pricing[0] ? formatCurrency(Number(app.pricing[0].amount)) : "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleFeatured.bind(null, app.id, !app.featured)}>
                      <button type="submit" aria-label="Toggle featured">
                        <Star className={`h-4 w-4 ${app.featured ? "fill-warning text-warning" : "text-muted"}`} />
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {app.status !== "PUBLISHED" ? (
                        <form action={setApplicationStatus.bind(null, app.id, "PUBLISHED")}>
                          <Button type="submit" size="sm" variant="secondary">
                            Publish
                          </Button>
                        </form>
                      ) : (
                        <form action={setApplicationStatus.bind(null, app.id, "UNPUBLISHED")}>
                          <Button type="submit" size="sm" variant="secondary">
                            Unpublish
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
