import { GraduationCap, Award, ListChecks, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";

const TEMPLATES = [
  {
    key: "students",
    title: "Students",
    description: "Roster columns the student importer expects, with your own class names filled in as examples.",
    href: "/api/data/templates/students",
    icon: GraduationCap,
    permission: PERMISSIONS.STUDENTS_CREATE,
  },
  {
    key: "results",
    title: "Results",
    description: "Score columns the results importer expects, including the optional className column for historical records.",
    href: "/api/data/templates/results",
    icon: Award,
    permission: PERMISSIONS.RESULTS_ENTER,
  },
  {
    key: "cbt-questions",
    title: "CBT question bank",
    description: "Multiple choice / multiple select / true-false question columns the question bank importer expects.",
    href: "/api/data/templates/cbt-questions",
    icon: ListChecks,
    permission: PERMISSIONS.CBT_MANAGE_QUESTION_BANK,
  },
] as const;

export default async function DataTemplatesPage() {
  const user = await requirePermission(PERMISSIONS.DATA_EXPORT);
  const perms = await getUserPermissions(user.id);
  const templates = TEMPLATES.filter((t) => perms.has(t.permission));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Download templates</h1>
        <p className="text-sm text-muted">
          Blank CSV files matching each importer&apos;s expected columns, with your school&apos;s own reference data filled in as
          examples so you can see the format before you upload.
        </p>
      </div>

      {templates.length === 0 ? (
        <EmptyState title="No templates available" description="You don't have access to any of Schoolum's bulk importers." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <t.icon className="h-4 w-4 text-accent" /> {t.title}
                </CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" size="sm">
                  <a href={t.href}>
                    <Download className="mr-1.5 h-4 w-4" /> Download CSV
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
