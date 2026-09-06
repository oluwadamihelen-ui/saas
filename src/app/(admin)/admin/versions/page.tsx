import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { publishVersion } from "./actions";

export const metadata: Metadata = { title: "Application Versions" };

export default async function AdminVersionsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);

  const versions = await prisma.applicationVersion.findMany({
    orderBy: { createdAt: "desc" },
    include: { application: true, deploymentSpecification: true, artifact: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Application Versions</h1>
          <p className="mt-1 text-sm text-muted">
            Application → Version → Deployment Specification → Artifact. Each release is deployed independently —
            publishing a new version never changes an existing customer&apos;s deployment.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/versions/new">
            <Plus className="h-4 w-4" /> Add Version
          </Link>
        </Button>
      </div>

      {versions.length === 0 ? (
        <EmptyState title="No versions yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Runtime</th>
                <th className="px-4 py-3">Artifact</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {versions.map((v) => (
                <tr key={v.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3 font-medium text-foreground">{v.application.name}</td>
                  <td className="px-4 py-3">
                    v{v.version} {v.isLatest && <Badge variant="accent">latest</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted">{v.deploymentSpecification?.runtime ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{v.artifact ? `${v.artifact.type}` : "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(v.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {v.status !== "STABLE" && (
                      <form action={publishVersion.bind(null, v.id)}>
                        <Button type="submit" size="sm" variant="secondary">
                          Publish
                        </Button>
                      </form>
                    )}
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
