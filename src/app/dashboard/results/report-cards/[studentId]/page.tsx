import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { computeReportCard } from "@/lib/services/results";
import { prisma } from "@/lib/db";
import { CommentsForm } from "./comments-form";
import { ApproveButton, PublishButton } from "./workflow-buttons";

const STATUS_VARIANT = { DRAFT: "neutral", APPROVED: "warning", PUBLISHED: "success" } as const;

export default async function ReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ termId?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const perms = await getUserPermissions(user.id);
  const { studentId } = await params;
  const { termId: termIdParam } = await searchParams;

  const termId = termIdParam || (await prisma.term.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } }))?.id;
  if (!termId) notFound();

  const studentExists = await prisma.student.findFirst({ where: { schoolId: user.schoolId, id: studentId } });
  if (!studentExists) notFound();

  const { student, term, reportCard, subjectRows, overallAverage, position, classSize } = await computeReportCard(
    user.schoolId,
    studentId,
    termId
  );
  const canApprove = perms.has(PERMISSIONS.RESULTS_APPROVE);
  const canPublish = perms.has(PERMISSIONS.RESULTS_PUBLISH) && reportCard.status === "APPROVED";

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{student.firstName} {student.lastName}</h1>
          <p className="text-sm text-muted">
            {student.admissionNumber} · {student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "—"} · {term?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[reportCard.status]}>{reportCard.status}</Badge>
          <Button asChild variant="secondary" size="sm">
            <a href={`/api/report-cards/${student.id}/pdf?termId=${termId}`} target="_blank" rel="noreferrer">Download PDF</a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Subjects</CardTitle></CardHeader>
        <CardContent className="p-0">
          {subjectRows.length === 0 ? (
            <p className="p-4 text-sm text-muted">No scores entered yet for this term.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Class average</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectRows.map((row) => (
                  <TableRow key={row.subjectId}>
                    <TableCell>{row.subjectName}</TableCell>
                    <TableCell>{row.total}/{row.maxTotal}</TableCell>
                    <TableCell className="text-muted">{row.classAverage}</TableCell>
                    <TableCell className="font-medium">{row.grade ?? "—"}</TableCell>
                    <TableCell className="text-muted">{row.remark ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center gap-6 border-t border-border p-4 text-sm">
            <div><span className="text-muted">Overall average: </span><span className="font-medium text-foreground">{overallAverage ?? "—"}</span></div>
            <div><span className="text-muted">Position: </span><span className="font-medium text-foreground">{position ? `${position} of ${classSize}` : "—"}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
        <CardContent>
          <CommentsForm
            studentId={student.id}
            termId={termId}
            teacherComment={reportCard.teacherComment ?? ""}
            principalComment={reportCard.principalComment ?? ""}
            canEditPrincipalComment={canApprove}
          />
        </CardContent>
      </Card>

      {(canApprove || canPublish) && (
        <div className="flex items-center gap-3">
          {canApprove && reportCard.status === "DRAFT" && <ApproveButton studentId={student.id} termId={termId} />}
          {canPublish && <PublishButton studentId={student.id} termId={termId} />}
        </div>
      )}

      <Link href="/dashboard/results/report-cards" className="text-sm text-accent">← Back to report cards</Link>
    </div>
  );
}
