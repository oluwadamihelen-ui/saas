import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { listAssessmentLevels } from "@/lib/services/preschool-results";
import { listClassGroupsWithMode } from "@/lib/services/scheme-of-work";
import { TogglesForm } from "./toggles-form";
import { LevelLabelForm } from "./level-label-form";
import { ClassModeForm } from "./class-mode-form";

export default async function PreschoolSettingsPage() {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);

  const [school, levels, classGroups] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
    listAssessmentLevels(user.schoolId),
    listClassGroupsWithMode(user.schoolId),
  ]);

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pre-School Results settings</h1>
        <p className="text-sm text-muted">Configure how developmental milestone assessment works for this school.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent>
          <TogglesForm school={school} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessment scale</CardTitle>
          <CardDescription>These labels and colours are what teachers, parents and students see — the underlying level codes never change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {levels.map((l) => (
            <LevelLabelForm key={l.level} level={l.level} label={l.label} colorVariant={l.colorVariant} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Class assessment mode</CardTitle>
          <CardDescription>Choose whether each class uses numeric Grader&apos;s Results, milestone Pre-School Results, or both.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {classGroups.length === 0 ? (
            <p className="text-sm text-muted">No classes yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {classGroups.map((cg) => (
                <li key={cg.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm font-medium text-foreground">{cg.name}</span>
                  <ClassModeForm classGroupId={cg.id} assessmentMode={cg.assessmentMode} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
