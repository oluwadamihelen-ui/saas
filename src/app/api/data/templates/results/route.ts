import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { buildResultsTemplateCsv } from "@/lib/services/import-templates";

/// Gated by RESULTS_ENTER — the same permission the results importer
/// itself requires.
export async function GET() {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const csv = await buildResultsTemplateCsv(user.schoolId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="results-import-template.csv"`,
    },
  });
}
