import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listAssignments } from "@/lib/services/assignments";
import { formatDate } from "@/lib/utils";

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.ASSIGNMENTS_MANAGE);

  const params = await searchParams;
  const { assignments, total, page, pageCount } = await listAssignments(user.schoolId, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Assignments</h1>
          <p className="text-sm text-muted">{total} assignment{total === 1 ? "" : "s"}</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/dashboard/assignments/new">New assignment</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {assignments.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              description="Create one to start tracking work for a class."
              className="p-8"
              action={
                canManage ? (
                  <Button asChild size="sm">
                    <Link href="/dashboard/assignments/new">New assignment</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Graded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/dashboard/assignments/${a.id}`} className="font-medium text-foreground hover:text-accent">
                        {a.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted">{a.classArm.classGroup.name} {a.classArm.name}</TableCell>
                    <TableCell className="text-muted">{a.subject.name}</TableCell>
                    <TableCell className="text-muted">{formatDate(a.dueDate)}</TableCell>
                    <TableCell className="text-muted">{a.gradedCount}/{a.totalCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Pagination page={page} pageCount={pageCount} basePath="/dashboard/assignments" />
    </div>
  );
}
