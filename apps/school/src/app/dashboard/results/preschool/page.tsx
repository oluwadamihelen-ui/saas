import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects } from "@/lib/services/academics";
import { prisma } from "@/lib/db";
import { getMilestoneAssessmentGrid, listAssessmentPeriods, listAssessmentLevels } from "@/lib/services/preschool-results";
import { MilestoneGridForm } from "./milestone-grid-form";
import { MilestoneGridReadOnly } from "./milestone-grid-readonly";
import { NewAssessmentPeriodForm } from "./new-assessment-period-form";

export default async function PreschoolResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ classArmId?: string; subjectId?: string; termId?: string; assessmentPeriodId?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const perms = await getUserPermissions(user.id);
  const canEnter = perms.has(PERMISSIONS.RESULTS_ENTER);
  const canManageMilestones = perms.has(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  const canManageSettings = perms.has(PERMISSIONS.GRADING_MANAGE);
  const params = await searchParams;

  const [classArms, subjects, terms, levels] = await Promise.all([
    prisma.classArm.findMany({
      where: { schoolId: user.schoolId, classGroup: { assessmentMode: { in: ["MILESTONE", "BOTH"] } } },
      include: { classGroup: true },
      orderBy: [{ classGroup: { order: "asc" } }, { name: "asc" }],
    }),
    listSubjects(user.schoolId),
    prisma.term.findMany({ where: { schoolId: user.schoolId }, orderBy: { startDate: "desc" }, include: { academicSession: true } }),
    listAssessmentLevels(user.schoolId),
  ]);

  const classArmId = params.classArmId || classArms[0]?.id;
  const subjectId = params.subjectId || subjects[0]?.id;
  const termId = params.termId || terms.find((t) => t.isCurrent)?.id || terms[0]?.id;

  const periods = termId ? await listAssessmentPeriods(user.schoolId, termId) : [];
  const assessmentPeriodId = params.assessmentPeriodId || periods[0]?.id;

  const grid =
    classArmId && subjectId && termId && assessmentPeriodId
      ? await getMilestoneAssessmentGrid(user.schoolId, classArmId, subjectId, termId, assessmentPeriodId)
      : null;

  if (classArms.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pre-School Results</h1>
        </div>
        <Card>
          <CardContent>
            <EmptyState
              title="No milestone-assessed classes yet"
              description="Set a class's assessment mode to Milestone (or Both) in Pre-School settings to start using developmental results for it."
              action={canManageSettings ? <Button asChild size="sm"><Link href="/dashboard/results/preschool/settings">Open settings</Link></Button> : undefined}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pre-School Results</h1>
          <p className="text-sm text-muted">Assess developmental milestones drawn from the Scheme of Work — not numerical scores.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link href="/dashboard/results">Grader&apos;s Results</Link>
          </Button>
          {canManageMilestones && (
            <Button asChild variant="secondary">
              <Link href="/dashboard/results/preschool/scheme-of-work">Scheme of Work</Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href="/dashboard/results/preschool/reports">Milestone reports</Link>
          </Button>
          {canManageSettings && (
            <Button asChild variant="secondary">
              <Link href="/dashboard/results/preschool/settings">Settings</Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assess a class</CardTitle>
          <CardDescription>Choose a term, class, subject and assessment period to load that class&apos;s milestones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="termId">Term</label>
              <Select id="termId" name="termId" defaultValue={termId ?? ""}>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.academicSession.name} · {t.name}</option>)}
              </Select>
            </div>
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Class</label>
              <Select id="classArmId" name="classArmId" defaultValue={classArmId ?? ""}>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>
                ))}
              </Select>
            </div>
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="subjectId">Subject</label>
              <Select id="subjectId" name="subjectId" defaultValue={subjectId ?? ""}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            {periods.length > 0 && (
              <div className="w-56 space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="assessmentPeriodId">Assessment period</label>
                <Select id="assessmentPeriodId" name="assessmentPeriodId" defaultValue={assessmentPeriodId ?? ""}>
                  {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
            )}
            <Button type="submit" variant="secondary">Load</Button>
          </form>

          {!termId ? (
            <EmptyState title="No terms set up" />
          ) : periods.length === 0 ? (
            <div className="space-y-3">
              <EmptyState title="No assessment period for this term yet" description='Create one, e.g. "Continuous Assessment" or "Mid-Term Test", to start assessing.' />
              {canEnter && <NewAssessmentPeriodForm termId={termId} />}
            </div>
          ) : !grid ? (
            <EmptyState title="Select a class, subject and period above" />
          ) : grid.rows.length === 0 ? (
            <EmptyState title="No active students in this class" />
          ) : grid.milestones.length === 0 ? (
            <EmptyState
              title="No milestones set up for this class and subject yet"
              description="Add a Scheme of Work with weeks/topics and milestones first."
              action={canManageMilestones ? <Button asChild size="sm"><Link href="/dashboard/results/preschool/scheme-of-work">Scheme of Work</Link></Button> : undefined}
            />
          ) : (
            <>
              {periods.length > 0 && canEnter && (
                <details className="rounded-md border border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-foreground">Add another assessment period</summary>
                  <div className="mt-3"><NewAssessmentPeriodForm termId={termId} /></div>
                </details>
              )}
              {canEnter ? (
                <MilestoneGridForm
                  classArmId={classArmId!}
                  subjectId={subjectId!}
                  termId={termId}
                  assessmentPeriodId={assessmentPeriodId!}
                  milestones={grid.milestones}
                  rows={grid.rows}
                  levels={levels}
                />
              ) : (
                <MilestoneGridReadOnly milestones={grid.milestones} rows={grid.rows} levels={levels} />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
