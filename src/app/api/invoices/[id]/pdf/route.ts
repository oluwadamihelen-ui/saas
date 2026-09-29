import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getInvoice } from "@/lib/services/invoices";
import { renderInvoicePdf } from "@/lib/services/invoice-pdf";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.INVOICES_VIEW);
  const { id } = await params;

  const invoice = await getInvoice(user.hotelId, id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const guest = await prisma.guest.findUnique({ where: { id: invoice.guestId } });
  const pdf = await renderInvoicePdf(invoice, guest ? `${guest.firstName} ${guest.lastName}` : "Guest");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
