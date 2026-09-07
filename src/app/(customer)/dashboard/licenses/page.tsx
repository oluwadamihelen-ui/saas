import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { listLicensesForCustomer } from "@/lib/services/licenses";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { updateAllowedDomains } from "./actions";

export const metadata: Metadata = { title: "Licenses" };

export default async function LicensesPage() {
  const user = await requireUser();
  const licenses = await listLicensesForCustomer(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Licenses</h1>
        <p className="mt-1 text-sm text-muted">
          Your license keys, for embedding in a deployed application that calls{" "}
          <code className="rounded bg-muted-surface px-1 py-0.5 text-xs">POST /api/licenses/verify</code> to confirm it&apos;s still authorized.
        </p>
      </div>

      {licenses.length === 0 ? (
        <EmptyState icon={<KeyRound className="h-8 w-8" />} title="No licenses yet" description="Licenses appear here once you purchase an application." />
      ) : (
        <div className="grid gap-4">
          {licenses.map((license) => {
            const updateDomains = updateAllowedDomains.bind(null, license.id);
            return (
              <Card key={license.id}>
                <CardContent>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{license.application.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted">{license.licenseKey}</p>
                    </div>
                    <StatusBadge status={license.status} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-y-1 text-xs text-muted sm:grid-cols-4">
                    <dt>Type</dt>
                    <dd className="text-foreground">{license.type}</dd>
                    <dt>Issued</dt>
                    <dd className="text-foreground">{formatDate(license.issuedAt)}</dd>
                    <dt>Expires</dt>
                    <dd className="text-foreground">{license.expiresAt ? formatDate(license.expiresAt) : "Never"}</dd>
                    <dt>Verifications</dt>
                    <dd className="text-foreground">
                      {license.verificationCount}
                      {license.lastVerifiedAt ? ` (last ${formatDate(license.lastVerifiedAt)})` : ""}
                    </dd>
                  </dl>

                  <form action={updateDomains} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                    <div className="min-w-[260px] flex-1 space-y-1.5">
                      <Label htmlFor={`domains-${license.id}`}>Allowed domains (comma-separated, blank = unrestricted)</Label>
                      <Input id={`domains-${license.id}`} name="allowedDomains" defaultValue={license.allowedDomains.join(", ")} placeholder="app.example.com" />
                    </div>
                    <Button type="submit" size="sm" variant="secondary">
                      Save
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
