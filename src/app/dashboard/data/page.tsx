import Link from "next/link";
import { Upload, Download, History, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listImportBatches } from "@/lib/services/import-history";

/// The Data Management hub is a directory, not a new import/export engine
/// — every card here links to functionality that already exists elsewhere
/// (the per-module import pages, the existing export API routes). It gives
/// staff one place to find all of it, plus the cross-module import history
/// that no single module page could show on its own.
export default async function DataManagementPage() {
  const user = await requireAnyPermission([PERMISSIONS.DATA_IMPORT, PERMISSIONS.DATA_EXPORT]);
  const canImport = user.perms.has(PERMISSIONS.DATA_IMPORT);
  const canExport = user.perms.has(PERMISSIONS.DATA_EXPORT);

  const recentBatches = canImport ? (await listImportBatches(user.schoolId, 1)).batches.slice(0, 5) : [];

  const cards = [
    {
      href: "/dashboard/data/import",
      icon: Upload,
      title: "Import data",
      description: "Bring students, results or CBT questions in from a spreadsheet instead of entering them one at a time.",
      show: canImport,
    },
    {
      href: "/dashboard/data/export",
      icon: Download,
      title: "Export data",
      description: "Download your school's students and results as CSV — the whole roster, or filtered to a session, term or class.",
      show: canExport,
    },
    {
      href: "/dashboard/data/history",
      icon: History,
      title: "Import history",
      description: "See every bulk import that's been run, who ran it, and which rows failed.",
      show: canImport,
    },
    {
      href: "/dashboard/data/templates",
      icon: FileSpreadsheet,
      title: "Download templates",
      description: "Blank CSV files matching each importer's expected columns, so you know the format before you upload.",
      show: canExport,
    },
  ].filter((c) => c.show);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Data management</h1>
        <p className="text-sm text-muted">Import, export, and keep track of bulk data changes across Schoolum.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.href}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <c.icon className="h-4 w-4 text-accent" /> {c.title}
              </CardTitle>
              <CardDescription>{c.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" size="sm">
                <Link href={c.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {canImport && (
        <Card>
          <CardHeader>
            <CardTitle>Recent imports</CardTitle>
            <CardDescription>The last few bulk imports run at your school.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentBatches.length === 0 ? (
              <p className="text-sm text-muted">No imports have been run yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentBatches.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="font-medium text-foreground">{b.fileName}</span>
                    <span className="text-muted">
                      {b.dataType} · {b.successCount}/{b.totalRows} rows · {b.createdAt.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Link href="/dashboard/data/history" className="text-sm text-accent hover:underline">
                View full import history &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
