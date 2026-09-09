import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getStudentAcademicHistory, computeTranscriptSummary, listTranscriptsForStudent } from "@/lib/services/transcripts";
import { formatDate } from "@/lib/utils";
import { GenerateButton } from "./generate-button";
import { RevokeButton } from "./revoke-button";

const STATUS_VARIANT = { ACTIVE: "success", REVOKED: "danger" } as const;

export default async function StudentTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.TRANSCRIPTS_VIEW);
  const perms = await getUserPermissions(user.id);
  const { id: studentId } = await params;

  const student = await prisma.student.findFirst({
    where: { schoolId: user.schoolId, id: studentId },
    include: { classArm: { include: { classGroup: true } } },
  });
  if (!student) notFound();

  const [{ sessions, isIncomplete }, transcripts] = await Promise.all([
    getStudentAcademicHistory(user.schoolId, studentId),
    listTranscriptsForStudent(user.schoolId, studentId),
  ]);
  const summary = await computeTranscriptSummary(user.schoolId, student, sessions);

  const latest = transcripts.find((t) => t.status === "ACTIVE") ?? transcripts[0] ?? null;
  const canManage = perms.has(PERMISSIONS.TRANSCRIPTS_MANAGE);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Academic Transcript</h1>
          <p className="text-sm text-muted">
            {student.firstName} {student.lastName} · {student.admissionNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {latest && latest.status === "ACTIVE" && (
            <>
              <Button asChild variant="secondary" size="sm">
                <a href={`/api/transcripts/${latest.id}/pdf?event=print`} target="_blank" rel="noreferrer">
                  Print
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <a href={`/api/transcripts/${latest.id}/pdf`} target="_blank" rel="noreferrer">
                  Download PDF
                </a>
              </Button>
            </>
          )}
          <GenerateButton studentId={studentId} hasExisting={transcripts.length > 0} />
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState title="No academic records are currently available for this student." />
      ) : (
        <>
          {latest && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Latest transcript reference</p>
                  <p className="font-medium text-foreground">{latest.referenceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Generated</p>
                  <p className="text-foreground">
                    {formatDate(latest.generatedAt)} by {latest.generatedBy.name}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[latest.status]}>{latest.status}</Badge>
              </CardContent>
            </Card>
          )}

          {isIncomplete && (
            <p className="rounded-md border border-dashed border-warning/40 bg-warning-soft px-4 py-2 text-xs text-warning">
              Academic records may be incomplete for some periods.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Field label="Sessions attended" value={String(summary.sessionsAttended)} />
              <Field
                label="Classes completed"
                value={summary.classesCompleted.length > 0 ? summary.classesCompleted.join(", ") : "Not recorded"}
              />
              <Field label="Years enrolled" value={String(summary.yearsEnrolled)} />
              <Field
                label="Overall performance"
                value={
                  summary.overallAverage !== null
                    ? `${summary.overallAverage}${summary.performanceRemark ? ` (${summary.performanceRemark})` : ""}`
                    : "—"
                }
              />
            </CardContent>
          </Card>

          {sessions.map((session) => (
            <Card key={session.sessionId}>
              <CardHeader>
                <CardTitle>{session.sessionName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-0">
                {session.terms.map((term) => (
                  <div key={term.termId} className="border-t border-border px-6 py-4 first:border-t-0">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-medium text-foreground">{term.termName}</p>
                      <p className="text-xs text-muted">Class: {term.classLabel ?? "Not recorded"}</p>
                    </div>
                    {term.subjectRows.length === 0 ? (
                      <p className="text-sm text-muted">No subject scores recorded for this term.</p>
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
                          {term.subjectRows.map((row) => (
                            <TableRow key={row.subjectId}>
                              <TableCell>{row.subjectName}</TableCell>
                              <TableCell>
                                {row.total}/{row.maxTotal}
                              </TableCell>
                              <TableCell className="text-muted">{row.classAverage}</TableCell>
                              <TableCell className="font-medium">{row.grade ?? "—"}</TableCell>
                              <TableCell className="text-muted">{row.remark ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    <div className="mt-3 flex items-center gap-6 text-xs text-muted">
                      <span>
                        Term average: <span className="font-medium text-foreground">{term.overallAverage ?? "—"}</span>
                      </span>
                      <span>
                        Position:{" "}
                        <span className="font-medium text-foreground">
                          {term.position ? `${term.position} of ${term.classSize}` : "—"}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transcript history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transcripts.length === 0 ? (
            <p className="p-4 text-sm text-muted">No transcript has been generated for this student yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
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
                        {canManage && t.status === "ACTIVE" && <RevokeButton transcriptId={t.id} studentId={studentId} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Link href={`/dashboard/students/${studentId}`} className="text-sm text-accent">
        ← Back to student profile
      </Link>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
