import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects, listTerms } from "@/lib/services/academics";
import { listAssessmentComponents } from "@/lib/services/results";
import { listExamTypes, listClassArmsForCandidates } from "@/lib/services/cbt-exams";
import { ExamWizard } from "../exam-wizard";

export default async function NewExamPage() {
  const user = await requirePermission(PERMISSIONS.CBT_CREATE);

  const [examTypes, subjects, terms, assessmentComponents, classArms] = await Promise.all([
    listExamTypes(user.schoolId),
    listSubjects(user.schoolId),
    listTerms(user.schoolId),
    listAssessmentComponents(user.schoolId),
    listClassArmsForCandidates(user.schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create exam</h1>
        <p className="text-sm text-muted">Work through each step, then save as a draft — you can review before publishing.</p>
      </div>

      <ExamWizard
        mode="create"
        examTypes={examTypes.map((t) => ({ id: t.id, label: t.label }))}
        subjects={subjects}
        terms={terms}
        assessmentComponents={assessmentComponents}
        classArms={classArms}
      />
    </div>
  );
}
