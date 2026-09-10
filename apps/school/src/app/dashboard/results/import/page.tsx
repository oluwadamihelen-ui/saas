import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listTerms, listSubjects } from "@/lib/services/academics";
import { listAssessmentComponents } from "@/lib/services/results";
import { ResultsImportForm } from "./import-form";

const TEMPLATE_HEADER = "sessionName,termName,admissionNumber,subjectCode,componentName,score";
const TEMPLATE_EXAMPLE = "2025/2026,First Term,2023-0014,MTH,CA1,18";

export default async function ImportResultsPage() {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);
  const [terms, subjects, components] = await Promise.all([
    listTerms(user.schoolId),
    listSubjects(user.schoolId),
    listAssessmentComponents(user.schoolId),
  ]);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Import results</h1>
        <p className="text-sm text-muted">
          Backfill a term&apos;s scores in bulk — including past sessions migrated from another system — instead of entering them one
          subject/class at a time in the score grid.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV format</CardTitle>
          <CardDescription>One header row, then one score per row — a subject with three components needs three rows per student.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted-surface p-3 text-xs text-foreground">
            {TEMPLATE_HEADER}
            {"\n"}
            {TEMPLATE_EXAMPLE}
          </pre>
          <p className="mt-2 text-xs text-muted">
            sessionName and termName together must match an existing term exactly (term names like &quot;First Term&quot; repeat across
            sessions). subjectCode and componentName must match your school&apos;s existing setup — see below. A row imported twice
            overwrites the earlier value rather than duplicating it.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {terms.length === 0 ? (
              <p className="text-xs text-muted">No terms set up yet.</p>
            ) : (
              terms.map((t) => (
                <Badge key={t.id} variant="neutral">{t.academicSession.name} · {t.name}</Badge>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Subject codes</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {subjects.length === 0 ? (
              <p className="text-xs text-muted">No subjects set up yet.</p>
            ) : (
              subjects.map((s) => <Badge key={s.id} variant="neutral">{s.code}</Badge>)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Components</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {components.length === 0 ? (
              <p className="text-xs text-muted">No assessment components set up yet.</p>
            ) : (
              components.map((c) => <Badge key={c.id} variant="neutral">{c.name} (max {c.maxScore})</Badge>)
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
