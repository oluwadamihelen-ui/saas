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
import { listBookLoans, listAllBooks } from "@/lib/services/library";
import { listActiveStudentsBrief } from "@/lib/services/students";
import { listAllStaff } from "@/lib/services/staff";
import { formatDate } from "@/lib/utils";
import { IssueLoanForm } from "../forms";
import { LoanActions } from "../loan-actions";

const STATUS_VARIANT = { ISSUED: "accent", RETURNED: "success", LOST: "danger" } as const;

export default async function LibraryLoansPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.LIBRARY_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.LIBRARY_MANAGE);
  const params = await searchParams;

  const [{ loans, total, page, pageCount }, books, students, staff] = await Promise.all([
    listBookLoans(user.schoolId, undefined, params.page ? Number(params.page) : 1),
    canManage ? listAllBooks(user.schoolId) : Promise.resolve([]),
    canManage ? listActiveStudentsBrief(user.schoolId) : Promise.resolve([]),
    canManage ? listAllStaff(user.schoolId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/library">&larr; Library</Link></Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Loans</h1>
          <p className="text-sm text-muted">{total} loan{total === 1 ? "" : "s"} on record</p>
        </div>
      </div>

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Issue a loan</CardTitle></CardHeader>
          <CardContent>
            <IssueLoanForm books={books} students={students} staff={staff.map((s) => ({ id: s.id, name: s.name }))} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-0">
          {loans.length === 0 ? (
            <EmptyState title="No loans yet" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium text-foreground">{l.book.title}</TableCell>
                    <TableCell className="text-muted">
                      {l.borrowerStudent ? `${l.borrowerStudent.firstName} ${l.borrowerStudent.lastName}` : l.borrowerUser?.name}
                    </TableCell>
                    <TableCell className="text-muted">{formatDate(l.issuedAt)}</TableCell>
                    <TableCell className="text-muted">{formatDate(l.dueAt)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[l.status]}>{l.status}</Badge></TableCell>
                    <TableCell className="text-right">{canManage && l.status === "ISSUED" && <LoanActions id={l.id} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="p-4 pt-0">
            <Pagination page={page} pageCount={pageCount} basePath="/dashboard/library/loans" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
