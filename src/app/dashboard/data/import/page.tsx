import Link from "next/link";
import { GraduationCap, Award, ListChecks, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";

/// Each entry links straight to the existing per-module import page — this
/// is a directory, not a second importer. Visibility here is gated by the
/// same specific permission that page's own requirePermission() checks
/// (mirroring the sidebar's "Import data" group), so this list never
/// offers a link that would just throw "Missing permission" when clicked.
const IMPORT_TYPES = [
  {
    key: "students",
    title: "Students",
    description: "Bring your existing student roster in from a spreadsheet.",
    href: "/dashboard/students/import",
    icon: GraduationCap,
    permission: PERMISSIONS.STUDENTS_CREATE,
  },
  {
    key: "results",
    title: "Results",
    description: "Backfill a term's scores in bulk, including past sessions migrated from another system.",
    href: "/dashboard/results/import",
    icon: Award,
    permission: PERMISSIONS.RESULTS_ENTER,
  },
  {
    key: "cbt-questions",
    title: "CBT question bank",
    description: "Upload multiple choice, multiple select, or true/false questions in bulk.",
    href: "/dashboard/cbt/question-bank/import",
    icon: ListChecks,
    permission: PERMISSIONS.CBT_MANAGE_QUESTION_BANK,
  },
  {
    key: "staff",
    title: "Staff",
    description: "Create or invite multiple staff accounts at once.",
    href: "/dashboard/staff/bulk",
    icon: Users,
    permission: PERMISSIONS.STAFF_INVITE,
  },
] as const;

export default async function DataImportPage() {
  const user = await requirePermission(PERMISSIONS.DATA_IMPORT);
  const perms = await getUserPermissions(user.id);
  const types = IMPORT_TYPES.filter((t) => perms.has(t.permission));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Import data</h1>
        <p className="text-sm text-muted">Choose what you want to bring in. Each import previews your file before anything is saved.</p>
      </div>

      {types.length === 0 ? (
        <EmptyState title="No imports available" description="You don't have permission to import any of Schoolum's supported data types." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <Card key={t.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <t.icon className="h-4 w-4 text-accent" /> {t.title}
                </CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" size="sm">
                  <Link href={t.href}>Import {t.title.toLowerCase()}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Link href="/dashboard/data/templates" className="text-sm text-accent hover:underline">
        Not sure of the file format? Download a CSV template &rarr;
      </Link>
    </div>
  );
}
