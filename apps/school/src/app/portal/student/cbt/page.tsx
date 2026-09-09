import Link from "next/link";
import { notFound } from "next/navigation";
import { MonitorCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { listCandidateExamsForStudent } from "@/lib/services/cbt-attempts";
import { formatDate } from "@/lib/utils";

export default async function StudentCbtPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const rows = await listCandidateExamsForStudent(user.schoolId, student.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Exams</h1>
        <p className="text-sm text-muted">Computer-based tests assigned to you.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<MonitorCheck className="h-6 w-6" />} title="No exams yet" description="Exams assigned to you will show up here." />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map(({ candidate, exam, attempts }) => {
            const inProgress = attempts.find((a) => a.status === "IN_PROGRESS");
            const usedAttempts = attempts.filter((a) => a.status !== "ABANDONED").length;
            const maxAttempts = candidate.maxAttemptsOverride ?? exam.maxAttempts;

            let action: { label: string; href: string } | null = null;
            let statusBadge: { label: string; variant: "success" | "accent" | "neutral" | "warning" } = { label: "Upcoming", variant: "neutral" };

            if (exam.status === "LIVE") {
              statusBadge = { label: "Available now", variant: "success" };
              if (inProgress) action = { label: "Resume", href: `/portal/student/cbt/${exam.id}/attempt/${inProgress.id}` };
              else if (usedAttempts < maxAttempts) action = { label: "Start", href: `/portal/student/cbt/${exam.id}` };
              else statusBadge = { label: "Attempts used", variant: "neutral" };
            } else if (exam.status === "PUBLISHED") {
              statusBadge = { label: "Upcoming", variant: "accent" };
            } else {
              statusBadge = { label: usedAttempts > 0 ? "Completed" : "Closed", variant: "warning" };
            }

            return (
              <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium text-foreground">{exam.title}</p>
                  <p className="text-muted">
                    {exam.subject.name} · {exam.examType.label} · {formatDate(exam.startAt)} · {exam.durationMinutes} min
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  {action && (
                    <Link href={action.href} className="text-sm font-medium text-accent hover:underline">
                      {action.label}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
