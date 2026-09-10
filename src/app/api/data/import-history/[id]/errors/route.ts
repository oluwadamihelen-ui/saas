import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getImportBatch } from "@/lib/services/import-history";
import { rowsToCsv } from "@/lib/csv";

const HEADER = ["rowNumber", "error"];

/// getImportBatch scopes the lookup to the caller's own schoolId, so an id
/// from another school's import batch resolves to nothing here — same
/// cross-tenant isolation as every other data-fetch in the app.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.DATA_IMPORT).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const batch = await getImportBatch(user.schoolId, id);
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rowErrors = (batch.rowErrors as { rowNumber: number; error: string }[] | null) ?? [];
  const rows = rowErrors.map((e) => [String(e.rowNumber), e.error]);
  const csv = rowsToCsv(HEADER, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${batch.fileName.replace(/\.csv$/i, "")}-errors.csv"`,
    },
  });
}
