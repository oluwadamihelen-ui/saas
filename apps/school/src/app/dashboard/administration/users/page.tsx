import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listAllAccounts } from "@/lib/services/administration-users";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { ACTIVE: "success", INVITED: "warning", SUSPENDED: "danger" } as const;

export default async function AllUsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const params = await searchParams;
  const { accounts, total, page, pageCount } = await listAllAccounts(user.schoolId, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard/administration/users/reset-password">Reset a password</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">All Users</h1>
        <p className="text-sm text-muted">{total} account{total === 1 ? "" : "s"} on this school — staff and portal logins</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-0">
          {accounts.length === 0 ? (
            <EmptyState title="No accounts yet" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                    <TableCell className="text-muted">{a.email}</TableCell>
                    <TableCell className="text-muted">{a.role.name}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge></TableCell>
                    <TableCell className="text-muted">{formatDate(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="p-4 pt-0">
            <Pagination page={page} pageCount={pageCount} basePath="/dashboard/administration/users" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
