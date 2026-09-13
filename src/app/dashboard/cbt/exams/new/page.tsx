import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects, listTerms } from "@/lib/services/academics";
import { listAssessmentComponents } from "@/lib/services/results";
import { listExamTypes, listClassArmsForCandidates } from "@/lib/services/cbt-exams";
import { getAccessibleAssignments, getAccessibleSubjectIds } from "@/lib/services/teacher-scope";
import { ExamWizard } from "../exam-wizard";

export default async function NewExamPage() {
  const user = await requirePermission(PERMISSIONS.CBT_CREATE);
  const perms = await getUserPermissions(user.id);

  const [examTypes, allSubjects, terms, assessmentComponents, allClassArms] = await Promise.all([
    listExamTypes(user.schoolId),
    listSubjects(user.schoolId),
    listTerms(user.schoolId),
    listAssessmentComponents(user.schoolId),
    listClassArmsForCandidates(user.schoolId),
  ]);

  // A teacher only picks from the subjects/classes they hold a
  // TeacherAssignment for — the server still validates the full
  // subject+class pairing on submit (assertCanActOnExamInput), since
  // these two lists are filtered independently and don't by themselves
  // guarantee only valid pairs get picked.
  const assignmentAccess = await getAccessibleAssignments(user.schoolId, user.id, perms);
  const subjectAccess = await getAccessibleSubjectIds(user.schoolId, user.id, perms);
  const subjects = subjectAccess === "ALL" ? allSubjects : allSubjects.filter((s) => subjectAccess.has(s.id));
  const classArms =
    assignmentAccess === "ALL" ? allClassArms : allClassArms.filter((a) => assignmentAccess.some((p) => p.classArmId === a.id));

  return (
    <div className="space-y-4 sm:space-y-6">
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
