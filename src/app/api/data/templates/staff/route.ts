import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { buildStaffTemplateCsv } from "@/lib/services/import-templates";

/// Gated by STAFF_INVITE — the same permission the bulk staff registration
/// page itself requires.
export async function GET() {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const csv = await buildStaffTemplateCsv(user.schoolId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="staff-import-template.csv"`,
    },
  });
}
