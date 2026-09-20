import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { buildGuardianTemplateCsv } from "@/lib/services/import-templates";

/// Gated by GUARDIANS_MANAGE — the same permission the bulk guardian
/// import page itself requires.
export async function GET() {
  const user = await requirePermission(PERMISSIONS.GUARDIANS_MANAGE).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const csv = await buildGuardianTemplateCsv(user.schoolId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="guardian-import-template.csv"`,
    },
  });
}
