import { notFound } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { getAttemptForTaking } from "@/lib/services/cbt-attempts";
import { ExamAttempt } from "./exam-attempt";

export default async function ExamAttemptPage({ params }: { params: Promise<{ examId: string; attemptId: string }> }) {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();
  const { attemptId } = await params;

  const attempt = await getAttemptForTaking(user.schoolId, student.id, attemptId);
  if (!attempt) notFound();

  if (attempt.status !== "IN_PROGRESS") {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <Check className="mx-auto h-10 w-10 text-success" />
        <h1 className="text-xl font-semibold text-foreground">This attempt has already been submitted</h1>
        <p className="text-sm text-muted">Your results will be available once grading is complete.</p>
        <Link href="/portal/student/cbt" className="text-sm font-medium text-accent hover:underline">
          Back to exams
        </Link>
      </div>
    );
  }

  return (
    <ExamAttempt
      attemptId={attempt.id}
      examTitle={attempt.exam.title}
      deadlineAt={attempt.deadlineAt.toISOString()}
      questions={attempt.questions}
      detectTabSwitch={attempt.exam.detectTabSwitch}
    />
  );
}
