import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listAllAccounts } from "@/lib/services/administration-users";
import { listAssignableRoles } from "@/lib/services/staff";
import { formatDate } from "@/lib/utils";
import { ChangeRoleDialog, SuspendReactivateButton } from "./user-row-actions";
import { RegenerateSetupLinkButton } from "@/app/dashboard/staff/pending-invite-actions";

const STATUS_VARIANT = { ACTIVE: "success", INVITED: "warning", SUSPENDED: "danger" } as const;
const STATUS_LABEL = { ACTIVE: "Active", INVITED: "Password setup pending", SUSPENDED: "Suspended" } as const;
const PORTAL_ROLE_KEYS = new Set(["PARENT", "STUDENT"]);

export default async function AllUsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const perms = await getUserPermissions(user.id);
  const canManageRoles = perms.has(PERMISSIONS.STAFF_MANAGE);
  const params = await searchParams;

  const [{ accounts, total, page, pageCount }, roles] = await Promise.all([
    listAllAccounts(user.schoolId, params.page ? Number(params.page) : 1),
    canManageRoles ? listAssignableRoles(user.schoolId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
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
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {canManageRoles && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => {
                  const isPortal = PORTAL_ROLE_KEYS.has(a.role.key);
                  const isOwner = a.role.key === "SCHOOL_OWNER";
                  const isSelf = a.id === user.id;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                      <TableCell className="text-muted">{a.email}</TableCell>
                      <TableCell className="text-muted">{a.staffId ?? "—"}</TableCell>
                      <TableCell className="text-muted">{a.role.name}</TableCell>
                      <TableCell className="text-muted">{a.department ?? "—"}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge></TableCell>
                      <TableCell className="text-muted">{formatDate(a.createdAt)}</TableCell>
                      {canManageRoles && (
                        <TableCell>
                          {isPortal ? (
                            <span className="text-xs text-muted">—</span>
                          ) : isOwner ? (
                            <span className="text-xs text-muted">School Owner</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              <ChangeRoleDialog userId={a.id} currentRoleName={a.role.name} roles={roles} isSelf={isSelf} />
                              {a.status === "INVITED" ? (
                                <RegenerateSetupLinkButton userId={a.id} name={a.name} />
                              ) : (
                                !isSelf && <SuspendReactivateButton userId={a.id} status={a.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"} />
                              )}
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
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
