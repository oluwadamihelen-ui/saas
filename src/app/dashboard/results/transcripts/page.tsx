import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listTranscriptsForSchool } from "@/lib/services/transcripts";
import { formatDate } from "@/lib/utils";
import { RevokeButton } from "@/app/dashboard/students/[id]/transcript/revoke-button";

const STATUS_VARIANT = { ACTIVE: "success", REVOKED: "danger" } as const;

export default async function TranscriptHistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.TRANSCRIPTS_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.TRANSCRIPTS_MANAGE);

  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const { transcripts, total, pageSize } = await listTranscriptsForSchool(user.schoolId, { query: params.q, page });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Transcript History</h1>
          <p className="text-sm text-muted">
            {total} transcript{total === 1 ? "" : "s"} issued across every student in the school.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard/results/report-cards">Report cards</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="w-72 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="q">
                Search
              </label>
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Student name or admission number" />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          {transcripts.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-6 w-6" />}
              title="No transcripts issued yet"
              description="Generate a transcript from a student's profile — it will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transcripts.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-foreground">{t.referenceNumber}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/students/${t.studentId}/transcript`} className="text-foreground hover:text-accent">
                        {t.student.firstName} {t.student.lastName}
                      </Link>
                      <p className="text-xs text-muted">{t.student.admissionNumber}</p>
                    </TableCell>
                    <TableCell className="text-muted">{formatDate(t.generatedAt)}</TableCell>
                    <TableCell className="text-muted">{t.generatedBy.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/transcripts/${t.id}/pdf`} target="_blank" rel="noreferrer">
                            Download
                          </a>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/verify-transcript?ref=${encodeURIComponent(t.referenceNumber)}`} target="_blank">
                            Verify
                          </Link>
                        </Button>
                        {canManage && t.status === "ACTIVE" && <RevokeButton transcriptId={t.id} studentId={t.studentId} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Pagination page={page} pageCount={pageCount} basePath="/dashboard/results/transcripts" query={params} />
        </CardContent>
      </Card>
    </div>
  );
}
