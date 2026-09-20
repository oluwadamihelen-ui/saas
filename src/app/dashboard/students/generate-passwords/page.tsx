import Link from "next/link";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { listClassArms } from "@/lib/services/academics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GeneratePasswordsForm } from "./generate-passwords-form";

export default async function GenerateStudentPasswordsPage({
  searchParams,
}: {
  searchParams: Promise<{ classArmId?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.STUDENTS_EDIT);
  const params = await searchParams;

  const [classArms, students] = await Promise.all([
    listClassArms(user.schoolId),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE", ...(params.classArmId ? { classArmId: params.classArmId } : {}) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        userId: true,
        classArm: { select: { name: true, classGroup: { select: { name: true } } } },
        guardians: { select: { guardianId: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Generate student portal passwords</h1>
        <p className="text-sm text-muted">
          For students who were bulk-imported and never individually invited. Pick a class, or select students directly, and choose
          how to share the login with their guardian. This creates an account only for students who don&rsquo;t already have one —{" "}
          <Link href="/dashboard/students/import" className="text-accent hover:underline">import more students</Link> first if the
          roster is incomplete.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select students</CardTitle>
          <CardDescription>
            Only students without a guardian reachable by the chosen medium, or who already have an account, will be skipped — the
            results screen tells you which.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GeneratePasswordsForm
            classArms={classArms.map((a) => ({ id: a.id, label: `${a.classGroup.name} ${a.name}` }))}
            selectedClassArmId={params.classArmId ?? ""}
            students={students.map((s) => ({
              id: s.id,
              name: `${s.firstName} ${s.lastName}`,
              admissionNumber: s.admissionNumber,
              className: s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : "Unassigned",
              hasAccount: Boolean(s.userId),
              hasGuardian: s.guardians.length > 0,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
