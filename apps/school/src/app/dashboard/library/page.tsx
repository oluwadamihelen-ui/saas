import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { BookOpen } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listBooks } from "@/lib/services/library";
import { AddBookForm } from "./forms";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.LIBRARY_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.LIBRARY_MANAGE);
  const params = await searchParams;

  const { books, total, page, pageCount } = await listBooks(user.schoolId, params.q, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Library</h1>
          <p className="text-sm text-muted">{total} title{total === 1 ? "" : "s"} in the catalog</p>
        </div>
        <Button asChild variant="secondary"><Link href="/dashboard/library/loans">Loans</Link></Button>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add a book</CardTitle>
            <CardDescription>Copies are checked when a loan is issued — no separate stock adjustment needed.</CardDescription>
          </CardHeader>
          <CardContent><AddBookForm /></CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Title or author" />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>

          {books.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No books found" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Availability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-foreground">{b.title}</TableCell>
                    <TableCell className="text-muted">{b.author}</TableCell>
                    <TableCell className="text-muted">{b.category ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={b.availableCopies > 0 ? "success" : "danger"}>
                        {b.availableCopies}/{b.totalCopies} available
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Pagination page={page} pageCount={pageCount} basePath="/dashboard/library" query={{ q: params.q }} />
        </CardContent>
      </Card>
    </div>
  );
}
