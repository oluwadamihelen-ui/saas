import Link from "next/link";
import { MonitorCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listExams } from "@/lib/services/cbt-exams";
import { listSubjects, listTerms } from "@/lib/services/academics";
import { formatDate } from "@/lib/utils";
import type { CBTExamStatus } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<CBTExamStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SCHEDULED: "accent",
  PUBLISHED: "accent",
  LIVE: "success",
  ENDED: "warning",
  GRADING: "warning",
  COMPLETED: "success",
  ARCHIVED: "neutral",
};

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; subjectId?: string; termId?: string; status?: string; page?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.CBT_VIEW);
  const perms = await getUserPermissions(user.id);
  const canCreate = perms.has(PERMISSIONS.CBT_CREATE);
  const params = await searchParams;

  const [{ exams, total, page, pageCount }, subjects, terms] = await Promise.all([
    listExams(user.schoolId, {
      search: params.q,
      subjectId: params.subjectId,
      termId: params.termId,
      status: (params.status as CBTExamStatus) || undefined,
      page: params.page ? Number(params.page) : 1,
    }),
    listSubjects(user.schoolId),
    listTerms(user.schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Exams</h1>
          <p className="text-sm text-muted">{total} exam{total === 1 ? "" : "s"}</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/cbt/exams/new">Create exam</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="q">Search</label>
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Exam title" />
            </div>
            <div className="w-48 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="subjectId">Subject</label>
              <Select id="subjectId" name="subjectId" defaultValue={params.subjectId ?? ""}>
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="w-44 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="termId">Term</label>
              <Select id="termId" name="termId" defaultValue={params.termId ?? ""}>
                <option value="">All terms</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div className="w-40 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="status">Status</label>
              <Select id="status" name="status" defaultValue={params.status ?? ""}>
                <option value="">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="LIVE">Live</option>
                <option value="ENDED">Ended</option>
                <option value="GRADING">Grading</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>

          {exams.length === 0 ? (
            <EmptyState
              icon={<MonitorCheck className="h-6 w-6" />}
              title="No exams found"
              description={canCreate ? "Try a different filter, or create your first exam." : "Try a different filter."}
              action={canCreate ? <Button asChild size="sm"><Link href="/dashboard/cbt/exams/new">Create exam</Link></Button> : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Opens</TableHead>
                  <TableHead>Candidates</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell>
                      <Link href={`/dashboard/cbt/exams/${exam.id}`} className="font-medium text-foreground hover:text-accent">
                        {exam.title}
                      </Link>
                      <div className="text-xs text-muted">{exam.examType.label}{exam.isPractice ? " · Practice" : ""}</div>
                    </TableCell>
                    <TableCell className="text-muted">{exam.subject.name}</TableCell>
                    <TableCell className="text-muted">{exam.term.name}</TableCell>
                    <TableCell className="text-muted">{formatDate(exam.startAt)}</TableCell>
                    <TableCell className="text-muted">{exam._count.candidates}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[exam.status]}>{exam.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Pagination page={page} pageCount={pageCount} basePath="/dashboard/cbt/exams" query={params} />
        </CardContent>
      </Card>
    </div>
  );
}
