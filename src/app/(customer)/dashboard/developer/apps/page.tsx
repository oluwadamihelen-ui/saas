import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { listApplicationsForDeveloper } from "@/lib/services/developer-applications";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Your Applications" };

export default async function DeveloperAppsPage() {
  const user = await requireRole("DEVELOPER");
  const applications = await listApplicationsForDeveloper(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your Applications</h1>
        <Button asChild size="sm">
          <Link href="/dashboard/developer/apps/new">Submit an App</Link>
        </Button>
      </div>

      {applications.length === 0 ? (
        <EmptyState title="No applications yet" description="Submit an app to get it into the marketplace review queue." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/dashboard/developer/apps/${app.id}`} className="hover:text-accent hover:underline">
                      {app.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{app.category.name}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(app.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
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
