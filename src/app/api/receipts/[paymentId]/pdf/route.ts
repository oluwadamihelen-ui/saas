import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { generateReceiptPdfBuffer } from "@/lib/services/receipt-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const user = await requirePermission(PERMISSIONS.PAYMENTS_VIEW).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentId } = await params;
  const pdf = await generateReceiptPdfBuffer(user.schoolId, paymentId).catch(() => null);
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt.pdf"` },
  });
}
