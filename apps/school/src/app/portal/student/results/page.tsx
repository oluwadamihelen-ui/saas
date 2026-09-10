import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { computeReportCard } from "@/lib/services/results";
import { getCurrentTerm } from "@/lib/services/academics";

export default async function StudentResultsPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const currentTerm = await getCurrentTerm(user.schoolId);
  const reportCard = currentTerm ? await computeReportCard(user.schoolId, student.id, currentTerm.id) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Results</h1>
        <p className="text-sm text-muted">{reportCard?.term?.name ?? "No active term"}</p>
      </div>

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
    </div>
  );
}
