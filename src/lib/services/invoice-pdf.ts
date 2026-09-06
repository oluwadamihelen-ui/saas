import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";

interface GeneralSettings {
  companyName?: string;
  supportEmail?: string;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Renders a professional invoice PDF server-side (pdfkit). Line items and
 * totals come from the Invoice/InvoiceItem records, which snapshot what was
 * actually charged -- never recomputed from current pricing.
 */
export async function generateInvoicePdfBuffer(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true, order: { include: { customer: true } } },
  });

  const generalSetting = await prisma.setting.findUnique({ where: { key: "general" } });
  const general = generalSetting?.value as GeneralSettings | undefined;
  const companyName = general?.companyName ?? "Forgecart, Inc.";
  const supportEmail = general?.supportEmail ?? "support@forgecart.example";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text(companyName);
    doc.fontSize(9).font("Helvetica").fillColor("#667085").text(supportEmail);
    doc.moveDown(1.5);

    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0f1115").text(`Invoice ${invoice.invoiceNumber}`);
    doc.fontSize(9).font("Helvetica").fillColor("#667085");
    doc.text(`Issued: ${invoice.issuedAt.toDateString()}`);
    if (invoice.dueDate) doc.text(`Due: ${invoice.dueDate.toDateString()}`);
    doc.text(`Status: ${invoice.status}`);
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f1115").text("Billed to");
    doc.fontSize(9).font("Helvetica").fillColor("#344054");
    doc.text(invoice.order.billingName ?? invoice.order.customer.name);
    doc.text(invoice.order.billingEmail ?? invoice.order.customer.email);
    if (invoice.order.billingCompany) doc.text(invoice.order.billingCompany);
    if (invoice.order.billingAddress) doc.text(invoice.order.billingAddress);
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#667085");
    doc.text("Description", 50, tableTop, { width: 300 });
    doc.text("Qty", 350, tableTop, { width: 50, align: "right" });
    doc.text("Unit Price", 400, tableTop, { width: 75, align: "right" });
    doc.text("Total", 475, tableTop, { width: 75, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor("#e4e6eb").stroke();

    let y = tableTop + 22;
    doc.font("Helvetica").fillColor("#0f1115");
    for (const item of invoice.items) {
      doc.fontSize(9);
      doc.text(item.description, 50, y, { width: 300 });
      doc.text(String(item.quantity), 350, y, { width: 50, align: "right" });
      doc.text(formatMoney(Number(item.unitPrice), invoice.currency), 400, y, { width: 75, align: "right" });
      doc.text(formatMoney(Number(item.total), invoice.currency), 475, y, { width: 75, align: "right" });
      y += 20;
    }

    doc.moveTo(50, y + 4).lineTo(550, y + 4).strokeColor("#e4e6eb").stroke();
    y += 14;

    const totalsRow = (label: string, value: string, bold = false) => {
      doc.fontSize(9).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(bold ? "#0f1115" : "#667085");
      doc.text(label, 350, y, { width: 125, align: "right" });
      doc.text(value, 475, y, { width: 75, align: "right" });
      y += 16;
    };

    totalsRow("Subtotal", formatMoney(Number(invoice.subtotal), invoice.currency));
    if (Number(invoice.discount) > 0) totalsRow("Discount", `-${formatMoney(Number(invoice.discount), invoice.currency)}`);
    totalsRow("Tax", formatMoney(Number(invoice.tax), invoice.currency));
    totalsRow("Total", formatMoney(Number(invoice.total), invoice.currency), true);

    if (invoice.paidAt) {
      doc.moveDown(2);
      doc.fontSize(9).font("Helvetica").fillColor("#0d8a4f").text(`Paid on ${invoice.paidAt.toDateString()}`, 50);
    }

    doc.end();
  });
}
