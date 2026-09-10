import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { buildStudentsTemplateCsv } from "@/lib/services/import-templates";

/// Gated by STUDENTS_CREATE — the same permission the student importer
/// itself requires — rather than DATA_IMPORT/DATA_EXPORT, so this route
/// stays reachable to anyone who could actually use the template.
export async function GET() {
  const user = await requirePermission(PERMISSIONS.STUDENTS_CREATE).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const csv = await buildStudentsTemplateCsv(user.schoolId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-import-template.csv"`,
    },
  });
}
