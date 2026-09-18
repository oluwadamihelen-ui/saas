import "server-only";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

/// "ALL" means school-wide access (an administrator); a Set means "only
/// these class arms" (a teacher, scoped to what TeacherAssignment says
/// they actually teach). Never derived from anything the client sends —
/// always resolved server-side from the authenticated user's own
/// permissions and their own TeacherAssignment rows.
export type ClassArmAccess = "ALL" | Set<string>;

/// The one authorization decision every entry point in this folder makes
/// before touching any student's data (brief Decision 1: stricter than
/// the existing Results page, which does not scope teachers to their own
/// classes today — this feature does not reuse that page's behavior).
/// ACADEMICS_MANAGE ("Manage sessions, terms, classes, subjects and
/// teacher assignments") is the existing permission every admin-tier
/// role already holds and TEACHER does not — chosen over inventing a new
/// permission key per Decision 2. A user with results.view/attendance.view
/// but neither ACADEMICS_MANAGE nor any TeacherAssignment row (a custom
/// role scoped to something else entirely) correctly sees nothing: those
/// two existing permissions alone are not, by themselves, proof of
/// school-wide analytics access.
export async function getAccessibleClassArmIds(schoolId: string, userId: string, perms: Set<string>): Promise<ClassArmAccess> {
  if (perms.has(PERMISSIONS.ACADEMICS_MANAGE)) return "ALL";

  const assignments = await prisma.teacherAssignment.findMany({
    where: { schoolId, teacherId: userId },
    select: { classArmId: true },
  });
  return new Set(assignments.map((a) => a.classArmId));
}

/// A null classArmId (no verified class context at all for this student
/// this term) is never treated as accessible to a teacher-scoped user —
/// "unknown" must fail closed, not open, when it's the difference between
/// two different students' data.
export function canAccessClassArm(access: ClassArmAccess, classArmId: string | null): boolean {
  if (access === "ALL") return true;
  if (!classArmId) return false;
  return access.has(classArmId);
}

export class PerformanceAccessDeniedError extends Error {
  constructor(message = "You are not authorized to view this student's performance analysis.") {
    super(message);
    this.name = "PerformanceAccessDeniedError";
  }
}
