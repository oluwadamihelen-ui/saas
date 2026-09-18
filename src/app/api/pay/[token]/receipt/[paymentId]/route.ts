import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateReceiptPdfBuffer } from "@/lib/services/receipt-pdf";

/// Public — no login. Knowing the invoice's unguessable payToken plus a
/// payment id that actually belongs to it is the authorization, the same
/// pattern as the staff-invite accept link.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; paymentId: string }> }) {
  const { token, paymentId } = await params;

  const payment = await prisma.payment.findFirst({ where: { id: paymentId, invoice: { payToken: token } } });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await generateReceiptPdfBuffer(payment.schoolId, paymentId).catch(() => null);
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt.pdf"` },
  });
}
