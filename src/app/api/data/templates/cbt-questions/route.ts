import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { buildCbtQuestionsTemplateCsv } from "@/lib/services/import-templates";

/// Gated by CBT_MANAGE_QUESTION_BANK — the same permission the question
/// bank importer itself requires.
export async function GET() {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const csv = await buildCbtQuestionsTemplateCsv(user.schoolId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cbt-questions-import-template.csv"`,
    },
  });
}
