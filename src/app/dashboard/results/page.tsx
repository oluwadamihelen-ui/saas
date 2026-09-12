import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms, listSubjects, listTerms, getCurrentTerm } from "@/lib/services/academics";
import { getScoreEntryGrid } from "@/lib/services/results";
import { ScoreGridForm } from "./score-grid-form";
import { ScoreGridReadOnly } from "./score-grid-readonly";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ classArmId?: string; subjectId?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManageGrading = perms.has(PERMISSIONS.GRADING_MANAGE);
  const canEnter = perms.has(PERMISSIONS.RESULTS_ENTER);
  const canViewTranscripts = perms.has(PERMISSIONS.TRANSCRIPTS_VIEW);

  const params = await searchParams;
  const [classArms, subjects, terms, currentTerm] = await Promise.all([
    listClassArms(user.schoolId),
    listSubjects(user.schoolId),
    listTerms(user.schoolId),
    getCurrentTerm(user.schoolId),
  ]);
  const sessions = Array.from(new Map(terms.map((t) => [t.academicSessionId, t.academicSession])).values());

  const classArmId = params.classArmId || classArms[0]?.id;
  const subjectId = params.subjectId || subjects[0]?.id;

  const grid = classArmId && subjectId && currentTerm
    ? await getScoreEntryGrid(user.schoolId, classArmId, subjectId, currentTerm.id)
    : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Results</h1>
          <p className="text-sm text-muted">
            {canEnter ? "Enter scores for" : "View scores for"} {currentTerm ? currentTerm.name : "the current term"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <a href="/api/results/export">Export CSV</a>
          </Button>
          {canEnter && (
            <Button asChild variant="secondary">
              <Link href="/dashboard/results/import">Import CSV</Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href="/dashboard/results/report-cards">Report cards</Link>
          </Button>
          {canViewTranscripts && (
            <Button asChild variant="secondary">
              <Link href="/dashboard/results/transcripts">Transcripts</Link>
            </Button>
          )}
          {canManageGrading && (
            <Button asChild variant="secondary">
              <Link href="/dashboard/results/grading">Grading setup</Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Score entry</CardTitle>
          <CardDescription>Scores from all components combine into each subject&apos;s total on the report card.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <form className="flex items-end gap-3" method="get">
            <div className="w-64 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Class</label>
              <Select id="classArmId" name="classArmId" defaultValue={classArmId ?? ""}>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>
                ))}
              </Select>
            </div>
            <div className="w-64 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="subjectId">Subject</label>
              <Select id="subjectId" name="subjectId" defaultValue={subjectId ?? ""}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <Button type="submit" variant="secondary">Load</Button>
          </form>

          {!currentTerm ? (
            <EmptyState title="No active term" description="Set a current term before entering scores." />
          ) : !grid || grid.rows.length === 0 ? (
            <EmptyState title="No active students in this class" />
          ) : grid.components.length === 0 ? (
            <EmptyState
              title="No assessment components configured"
              description="Set up components like '1st CA' and 'Exam' first."
              action={
                canManageGrading ? (
                  <Button asChild size="sm"><Link href="/dashboard/results/grading">Grading setup</Link></Button>
                ) : undefined
              }
            />
          ) : canEnter ? (
            <ScoreGridForm
              classArmId={classArmId!}
              subjectId={subjectId!}
              termId={currentTerm.id}
              components={grid.components}
              rows={grid.rows}
            />
          ) : (
            <ScoreGridReadOnly components={grid.components} rows={grid.rows} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export results</CardTitle>
          <CardDescription>
            Leave a filter on &quot;All&quot; to include everything for it. Class filters use each score&apos;s own recorded class, not a
            student&apos;s current one — a class-specific export won&apos;t include scores with no verified class on record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" method="get" action="/api/results/export">
            <div className="w-48 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="export-sessionId">Session</label>
              <Select id="export-sessionId" name="sessionId" defaultValue="">
                <option value="">All sessions</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="w-48 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="export-termId">Term</label>
              <Select id="export-termId" name="termId" defaultValue="">
                <option value="">All terms</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.academicSession.name} · {t.name}</option>)}
              </Select>
            </div>
            <div className="w-48 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="export-classArmId">Class</label>
              <Select id="export-classArmId" name="classArmId" defaultValue="">
                <option value="">All classes</option>
                {classArms.map((arm) => <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>)}
              </Select>
            </div>
            <div className="w-48 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="export-subjectId">Subject</label>
              <Select id="export-subjectId" name="subjectId" defaultValue="">
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <Button type="submit" variant="secondary">Export CSV</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
