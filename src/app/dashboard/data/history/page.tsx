import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listImportBatches } from "@/lib/services/import-history";

const DATA_TYPE_LABEL: Record<string, string> = {
  STUDENTS: "Students",
  RESULTS: "Results",
  CBT_QUESTIONS: "CBT questions",
};

export default async function ImportHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.DATA_IMPORT);
  const params = await searchParams;
  const { batches, total, page, pageCount } = await listImportBatches(user.schoolId, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Import history</h1>
        <p className="text-sm text-muted">{total} import{total === 1 ? "" : "s"} run at your school.</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          {batches.length === 0 ? (
            <EmptyState title="No imports yet" description="Imports you run from the Data Management hub or any module's import page will show up here." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Imported by</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => {
                    const context = [
                      b.academicSession?.name,
                      b.term?.name,
                      b.classArm ? `${b.classArm.classGroup.name} ${b.classArm.name}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-muted">{b.createdAt.toLocaleString()}</TableCell>
                        <TableCell>{DATA_TYPE_LABEL[b.dataType] ?? b.dataType}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{b.fileName}</TableCell>
                        <TableCell className="text-muted">{context || "—"}</TableCell>
                        <TableCell>
                          {b.successCount}/{b.totalRows}
                          {b.failedCount > 0 && <span className="text-danger"> ({b.failedCount} failed)</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.status === "COMPLETED" ? "success" : "danger"}>{b.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted">{b.importedBy.name}</TableCell>
                        <TableCell>
                          {b.failedCount > 0 ? (
                            <a href={`/api/data/import-history/${b.id}/errors`} className="text-accent hover:underline">
                              Download report
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination page={page} pageCount={pageCount} basePath="/dashboard/data/history" query={params} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
