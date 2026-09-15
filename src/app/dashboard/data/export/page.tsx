import { GraduationCap, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms, listSubjects, listTerms } from "@/lib/services/academics";

/// Both exports below submit straight to the existing /api/students/export
/// and /api/results/export routes (see those files) — this page adds no
/// new export logic of its own, just a shared place to reach both, plus
/// the filter form the results module already exposes on its own page.
export default async function DataExportPage() {
  const user = await requirePermission(PERMISSIONS.DATA_EXPORT);
  const perms = await getUserPermissions(user.id);
  const canExportStudents = perms.has(PERMISSIONS.STUDENTS_VIEW);
  const canExportResults = perms.has(PERMISSIONS.RESULTS_VIEW);

  const [classArms, subjects, terms] = canExportResults
    ? await Promise.all([listClassArms(user.schoolId), listSubjects(user.schoolId), listTerms(user.schoolId)])
    : [[], [], []];
  const sessions = Array.from(new Map(terms.map((t) => [t.academicSessionId, t.academicSession])).values());

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Export data</h1>
        <p className="text-sm text-muted">Download your school&apos;s data as CSV — for backup, or to move it into another system.</p>
      </div>

      {!canExportStudents && !canExportResults && (
        <p className="text-sm text-muted">You don&apos;t have permission to export any of Schoolum&apos;s supported data types.</p>
      )}

      {canExportStudents && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-accent" /> Students
            </CardTitle>
            <CardDescription>Every student in your school&apos;s roster, in the same column shape the student importer accepts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" size="sm">
              <a href="/api/students/export">Export CSV</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {canExportResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-4 w-4 text-accent" /> Results
            </CardTitle>
            <CardDescription>
              Leave a filter on &quot;All&quot; to include everything for it. Class filters use each score&apos;s own recorded class,
              not a student&apos;s current one — a class-specific export won&apos;t include scores with no verified class on record.
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
      )}
    </div>
  );
}
