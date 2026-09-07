import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { setLicenseStatus } from "./actions";

export const metadata: Metadata = { title: "Licenses" };

export default async function AdminLicensesPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);

  const licenses = await prisma.applicationLicense.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true, application: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Licenses</h1>

      {licenses.length === 0 ? (
        <EmptyState title="No licenses yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">License Key</th>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {licenses.map((license) => {
                const suspend = setLicenseStatus.bind(null, license.id, "SUSPENDED");
                const reactivate = setLicenseStatus.bind(null, license.id, "ACTIVE");
                const revoke = setLicenseStatus.bind(null, license.id, "REVOKED");
                return (
                  <tr key={license.id} className="hover:bg-muted-surface">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{license.licenseKey}</td>
                    <td className="px-4 py-3 text-muted">{license.application.name}</td>
                    <td className="px-4 py-3 text-muted">{license.customer.name}</td>
                    <td className="px-4 py-3 text-muted">
                      {license.verificationCount > 0 ? `${license.verificationCount}× · last ${formatDate(license.lastVerifiedAt!)}` : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={license.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {license.status !== "ACTIVE" && (
                          <form action={reactivate}>
                            <Button type="submit" size="sm" variant="ghost">
                              Reactivate
                            </Button>
                          </form>
                        )}
                        {license.status === "ACTIVE" && (
                          <form action={suspend}>
                            <Button type="submit" size="sm" variant="ghost">
                              Suspend
                            </Button>
                          </form>
                        )}
                        {license.status !== "REVOKED" && (
                          <form action={revoke}>
                            <Button type="submit" size="sm" variant="destructive">
                              Revoke
                            </Button>
                          </form>
                        )}
                      </div>
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
