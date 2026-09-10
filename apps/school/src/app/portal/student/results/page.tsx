import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { computeReportCard } from "@/lib/services/results";
import { computePreschoolReport, listAssessmentLevels } from "@/lib/services/preschool-results";
import { getCurrentTerm } from "@/lib/services/academics";
import { prisma } from "@/lib/db";

const VARIANTS = ["neutral", "accent", "secondary", "success", "warning", "danger"] as const;
type BadgeVariant = (typeof VARIANTS)[number];

export default async function StudentResultsPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const [currentTerm, school] = await Promise.all([
    getCurrentTerm(user.schoolId),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);
  const reportCard = currentTerm ? await computeReportCard(user.schoolId, student.id, currentTerm.id) : null;

  const assessmentMode = student.classArm?.classGroup.assessmentMode ?? "NUMERICAL";
  const showMilestones = (assessmentMode === "MILESTONE" || assessmentMode === "BOTH") && school.preschoolStudentsCanView;
  const [milestoneReport, levels] = showMilestones && currentTerm
    ? await Promise.all([computePreschoolReport(user.schoolId, student.id, currentTerm.id), listAssessmentLevels(user.schoolId)])
    : [null, []];
  const byLevel = new Map(levels.map((l) => [l.level, l]));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Results</h1>
        <p className="text-sm text-muted">{reportCard?.term?.name ?? "No active term"}</p>
      </div>

      {(assessmentMode === "NUMERICAL" || assessmentMode === "BOTH") && (
        <Card>
          <CardContent className="space-y-4">
            {!reportCard || reportCard.subjectRows.length === 0 ? (
              <EmptyState title="No scores entered yet this term" />
            ) : (
              <>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {reportCard.subjectRows.map((row) => (
                    <li key={row.subjectId} className="flex items-center justify-between p-3 text-sm">
                      <span className="text-foreground">{row.subjectName}</span>
                      <span className="text-muted">{row.total}/{row.maxTotal} · {row.grade ?? "—"}</span>
                    </li>
                  ))}
                </ul>
                {reportCard.reportCard.status === "PUBLISHED" && (
                  <Link
                    href={`/api/report-cards/${student.id}/pdf?termId=${reportCard.term?.id}`}
                    className="text-sm text-accent hover:underline"
                  >
                    Download report card PDF
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {showMilestones && (
        <Card>
          <CardHeader><CardTitle>Developmental milestones</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!milestoneReport || milestoneReport.report.status !== "PUBLISHED" ? (
              <EmptyState title="No milestone report published yet this term" />
            ) : (
              <>
                {milestoneReport.subjects.map((subject) => (
                  <div key={subject.subjectId} className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{subject.subjectName}</h3>
                    {subject.topics.map((topic) => (
                      <ul key={topic.topicTitle} className="space-y-2 border-l-2 border-border pl-3">
                        {topic.milestones.map((m) => {
                          const level = m.level ? byLevel.get(m.level) : null;
                          return (
                            <li key={m.milestoneId} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                              <span className="text-foreground">{m.title}</span>
                              {level && (
                                <Badge variant={(VARIANTS.includes(level.colorVariant as BadgeVariant) ? level.colorVariant : "neutral") as BadgeVariant}>
                                  {level.label}
                                </Badge>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ))}
                  </div>
                ))}
                {milestoneReport.report.overallComment && (
                  <p className="border-t border-border pt-3 text-sm text-muted">{milestoneReport.report.overallComment}</p>
                )}
                <Link
                  href={`/api/preschool-reports/${student.id}/pdf?termId=${milestoneReport.term?.id}`}
                  className="text-sm text-accent hover:underline"
                >
                  Download milestone report PDF
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
