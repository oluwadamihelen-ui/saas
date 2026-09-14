import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import { listBuyersForPlatform } from "@/lib/services/buyer-onboarding";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Buyers" };

const STATUS_VARIANT = { ACTIVE: "success", SUSPENDED: "danger" } as const;

export default async function PlatformBuyersPage() {
  await requireSuperAdmin();
  const buyers = await listBuyersForPlatform();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Buyers</h1>
        <p className="text-sm text-muted">{buyers.length} standalone purchasing client{buyers.length === 1 ? "" : "s"}</p>
      </div>

      <Card>
        <CardContent className="p-5">
          {buyers.length === 0 ? (
            <EmptyState
              title="No Buyers yet"
              description="Convert an enterprise inquiry into a Buyer account from the Enterprise inquiries page."
              className="p-8"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agreements</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyers.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/platform/buyers/${b.id}`} className="font-medium text-foreground hover:text-accent">
                        {b.displayName}
                      </Link>
                      <p className="text-xs text-muted">{b.user.email}</p>
                    </TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge></TableCell>
                    <TableCell className="text-muted">{b._count.agreements}</TableCell>
                    <TableCell className="text-muted">{b._count.invoices}</TableCell>
                    <TableCell className="text-muted">{formatDate(b.createdAt)}</TableCell>
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
