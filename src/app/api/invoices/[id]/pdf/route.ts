import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateInvoicePdfBuffer } from "@/lib/services/invoice-pdf";
import { getUserPermissions } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = invoice.customerId === session.user.id;
  let isAuthorizedStaff = false;
  if (!isOwner) {
    if (session.user.role === "SUPER_ADMIN") {
      isAuthorizedStaff = true;
    } else if (session.user.role === "STAFF") {
      const perms = await getUserPermissions(session.user.id);
      isAuthorizedStaff = perms.has(PERMISSIONS.INVOICES_MANAGE);
    }
  }

  if (!isOwner && !isAuthorizedStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdf = await generateInvoicePdfBuffer(id);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
