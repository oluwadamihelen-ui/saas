import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { computePreschoolReport, listAssessmentLevels } from "@/lib/services/preschool-results";
import { prisma } from "@/lib/db";
import { CommentsForm } from "./comments-form";
import { SubmitButton, ApproveButton, PublishButton, ReopenButton } from "./workflow-buttons";

const STATUS_VARIANT = { DRAFT: "neutral", SUBMITTED: "accent", APPROVED: "warning", PUBLISHED: "success" } as const;
const VARIANTS = ["neutral", "accent", "secondary", "success", "warning", "danger"] as const;
type BadgeVariant = (typeof VARIANTS)[number];

export default async function PreschoolReportPage({
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

  const [{ student, term, report, subjects, summary, totalMilestonesAssessed }, levels] = await Promise.all([
    computePreschoolReport(user.schoolId, studentId, termId),
    listAssessmentLevels(user.schoolId),
  ]);
  const byLevel = new Map(levels.map((l) => [l.level, l]));

  const canEnter = perms.has(PERMISSIONS.RESULTS_ENTER);
  const canApprove = perms.has(PERMISSIONS.RESULTS_APPROVE);
  const canPublish = perms.has(PERMISSIONS.RESULTS_PUBLISH);

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
          <Badge variant={STATUS_VARIANT[report.status]}>{report.status}</Badge>
          <Button asChild variant="secondary" size="sm">
            <a href={`/api/preschool-reports/${student.id}/pdf?termId=${termId}`} target="_blank" rel="noreferrer">Download PDF</a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Milestone progress</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            {levels.map((l) => (
              <Badge key={l.level} variant={(VARIANTS.includes(l.colorVariant as BadgeVariant) ? l.colorVariant : "neutral") as BadgeVariant}>
                {l.label}: {summary[l.level as keyof typeof summary] ?? 0}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted">{totalMilestonesAssessed} milestone{totalMilestonesAssessed === 1 ? "" : "s"} assessed this term.</p>

          {subjects.length === 0 ? (
            <p className="text-sm text-muted">No milestones assessed yet for this term.</p>
          ) : (
            <div className="space-y-6">
              {subjects.map((subject) => (
                <div key={subject.subjectId} className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{subject.subjectName}</h3>
                  {subject.topics.map((topic) => (
                    <div key={topic.topicTitle} className="space-y-2 border-l-2 border-border pl-3">
                      <p className="text-xs font-medium text-muted">Week {topic.weekNumber} · {topic.topicTitle}</p>
                      <ul className="space-y-2">
                        {topic.milestones.map((m) => {
                          const level = m.level ? byLevel.get(m.level) : null;
                          return (
                            <li key={m.milestoneId} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                              <div>
                                <p className="text-foreground">{m.title}</p>
                                {m.comment && <p className="text-xs text-muted">{m.comment}</p>}
                                <p className="text-xs text-muted">{m.assessmentPeriod}</p>
                              </div>
                              {level && (
                                <Badge variant={(VARIANTS.includes(level.colorVariant as BadgeVariant) ? level.colorVariant : "neutral") as BadgeVariant}>
                                  {level.label}
                                </Badge>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
        <CardContent>
          <CommentsForm
            studentId={student.id}
            termId={termId}
            overallComment={report.overallComment ?? ""}
            teacherComment={report.teacherComment ?? ""}
            principalComment={report.principalComment ?? ""}
            canEditPrincipalComment={canApprove}
          />
        </CardContent>
      </Card>

      {(canEnter || canApprove || canPublish) && (
        <div className="flex flex-wrap items-center gap-3">
          {canEnter && report.status === "DRAFT" && <SubmitButton studentId={student.id} termId={termId} />}
          {canApprove && report.status === "SUBMITTED" && <ApproveButton studentId={student.id} termId={termId} />}
          {canPublish && report.status === "APPROVED" && <PublishButton studentId={student.id} termId={termId} />}
          {canApprove && (report.status === "APPROVED" || report.status === "PUBLISHED") && <ReopenButton studentId={student.id} termId={termId} />}
        </div>
      )}

      <Link href="/dashboard/results/preschool/reports" className="text-sm text-accent">← Back to milestone reports</Link>
    </div>
  );
}
