import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects, listTerms } from "@/lib/services/academics";
import { listAssessmentComponents } from "@/lib/services/results";
import { getExam, listExamTypes, listClassArmsForCandidates } from "@/lib/services/cbt-exams";
import { ExamWizard, type ExamWizardInitial } from "../../exam-wizard";

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.CBT_EDIT);
  const { id } = await params;

  const exam = await getExam(user.schoolId, id);
  if (!exam) notFound();
  if (exam.status !== "DRAFT") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit exam</h1>
        <p className="text-sm text-muted">
          Only draft exams can be edited. Unpublish this exam from its detail page first if you need to change it.
        </p>
      </div>
    );
  }

  const [examTypes, subjects, terms, assessmentComponents, classArms] = await Promise.all([
    listExamTypes(user.schoolId),
    listSubjects(user.schoolId),
    listTerms(user.schoolId),
    listAssessmentComponents(user.schoolId),
    listClassArmsForCandidates(user.schoolId),
  ]);

  const initial: ExamWizardInitial = {
    title: exam.title,
    examTypeId: exam.examTypeId,
    subjectId: exam.subjectId,
    termId: exam.termId,
    assessmentComponentId: exam.assessmentComponentId,
    instructions: exam.instructions,
    isPractice: exam.isPractice,
    questionSelectionMode: exam.questionSelectionMode,
    selectedQuestions: exam.examQuestions.map((eq) => ({
      id: eq.question.id,
      prompt: eq.question.prompt,
      type: eq.question.type,
      difficulty: eq.question.difficulty,
      marks: eq.marksOverride ?? eq.question.marks,
      topic: eq.question.topic,
    })),
    blueprintTotalQuestions: exam.blueprint?.totalQuestions ?? 10,
    blueprintRules: exam.blueprint?.rules.map((r) => ({ topic: r.topic, difficulty: r.difficulty, count: r.count })) ?? [
      { topic: "", difficulty: null, count: 10 },
    ],
    randomizeQuestionOrder: exam.randomizeQuestionOrder,
    randomizeOptionOrder: exam.randomizeOptionOrder,
    negativeMarkingEnabled: exam.negativeMarkingEnabled,
    negativeMarkPerWrong: exam.negativeMarkPerWrong,
    startAt: toLocalInputValue(exam.startAt),
    endAt: toLocalInputValue(exam.endAt),
    durationMinutes: exam.durationMinutes,
    requireFullscreen: exam.requireFullscreen,
    detectTabSwitch: exam.detectTabSwitch,
    restrictCopyPaste: exam.restrictCopyPaste,
    restrictRightClick: exam.restrictRightClick,
    maxAttempts: exam.maxAttempts,
    autoSubmitOnExpiry: exam.autoSubmitOnExpiry,
    desktopOnly: exam.desktopOnly,
    resultVisibility: exam.resultVisibility,
    showCorrectAnswers: exam.showCorrectAnswers,
    showExplanations: exam.showExplanations,
    showRanking: exam.showRanking,
    classArmIds: [],
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit exam</h1>
        <p className="text-sm text-muted">
          Candidates were snapshotted from classes when this exam was created — re-check the Candidates step if class rosters have changed.
        </p>
      </div>

      <ExamWizard
        mode="edit"
        examId={exam.id}
        examTypes={examTypes.map((t) => ({ id: t.id, label: t.label }))}
        subjects={subjects}
        terms={terms}
        assessmentComponents={assessmentComponents}
        classArms={classArms}
        initial={initial}
      />
    </div>
  );
}
