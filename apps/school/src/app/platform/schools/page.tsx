import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requireSuperAdmin } from "@/lib/auth/require";
import { listSchoolsForPlatform } from "@/lib/services/platform";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { TRIAL: "warning", ACTIVE: "success", SUSPENDED: "danger" } as const;

export default async function PlatformSchoolsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const { schools, total, page, pageCount } = await listSchoolsForPlatform(params.q, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Schools</h1>
        <p className="text-sm text-muted">{total} school{total === 1 ? "" : "s"} on the platform</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="School name" />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>

          {schools.length === 0 ? (
            <EmptyState title="No schools found" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/platform/schools/${s.id}`} className="font-medium text-foreground hover:text-accent">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge></TableCell>
                    <TableCell className="text-muted">
                      {s.subscription ? `${s.subscription.plan.name} (${formatMoney(s.subscription.plan.priceMinor, "NGN")}/mo)` : "—"}
                    </TableCell>
                    <TableCell className="text-muted">{s._count.students}</TableCell>
                    <TableCell className="text-muted">{s._count.users}</TableCell>
                    <TableCell className="text-muted">{formatDate(s.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Pagination page={page} pageCount={pageCount} basePath="/platform/schools" query={{ q: params.q }} />
        </CardContent>
      </Card>
    </div>
  );
}
