import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export async function generateReceiptPdfBuffer(schoolId: string, paymentId: string): Promise<Buffer> {
  const payment = await prisma.payment.findFirstOrThrow({
    where: { schoolId, id: paymentId },
    include: { invoice: { include: { student: true, school: true } } },
  });
  if (payment.status !== "CONFIRMED") throw new Error("This payment hasn't been confirmed yet.");

  const { school, student } = payment.invoice;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#131a2b").text(school.name);
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478").text([school.city, school.state, school.country].filter(Boolean).join(", "));
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a6fba").text("Payment Receipt");
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478");
    doc.text(`Reference: ${payment.reference}`);
    doc.text(`Date: ${(payment.paidAt ?? payment.createdAt).toDateString()}`);
    doc.text(`Method: ${payment.method.replace("_", " ")}`);
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#131a2b").text("Received from");
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478");
    doc.text(`${student.firstName} ${student.lastName} (${student.admissionNumber})`);
    doc.moveDown(1);

    doc.fontSize(9).font("Helvetica").fillColor("#5b6478").text(`Against invoice ${payment.invoice.invoiceNumber}`);
    doc.moveDown(0.5);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0d8a4f").text(formatMoney(payment.amountMinor, school.currency));

    doc.end();
  });
}
