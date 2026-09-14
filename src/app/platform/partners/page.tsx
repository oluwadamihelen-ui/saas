import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import { listPartnersForPlatform } from "@/lib/services/partner-onboarding";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Partners" };

const STATUS_VARIANT = { PENDING: "warning", ACTIVE: "success", SUSPENDED: "danger", REJECTED: "neutral" } as const;

export default async function PlatformPartnersPage() {
  await requireSuperAdmin();
  const partners = await listPartnersForPlatform();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Partners</h1>
          <p className="text-sm text-muted">{partners.length} Partner{partners.length === 1 ? "" : "s"} in the program</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm"><Link href="/platform/partners/withdrawals">Withdrawals</Link></Button>
          <Button asChild variant="secondary" size="sm"><Link href="/platform/partners/settings">Commission settings</Link></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          {partners.length === 0 ? (
            <EmptyState title="No Partners yet" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Referrals</TableHead>
                  <TableHead>Agreements</TableHead>
                  <TableHead>Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/platform/partners/${p.id}`} className="font-medium text-foreground hover:text-accent">
                        {p.displayName}
                      </Link>
                      <p className="text-xs text-muted">{p.user.email}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.partnerCode}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge></TableCell>
                    <TableCell className="text-muted">{p._count.referrals}</TableCell>
                    <TableCell className="text-muted">{p._count.agreements}</TableCell>
                    <TableCell className="text-muted">{formatDate(p.appliedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
