import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { computeReportCard } from "@/lib/services/results";

/**
 * Renders a report card PDF server-side (pdfkit). Subject totals/grades and
 * class position are always recomputed from live Score rows via
 * computeReportCard — never cached on the ReportCard row — so a PDF
 * downloaded after a late score correction is always current.
 */
export async function generateReportCardPdfBuffer(schoolId: string, studentId: string, termId: string): Promise<Buffer> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  const { student, term, reportCard, subjectRows, overallAverage, position, classSize } = await computeReportCard(
    schoolId,
    studentId,
    termId
  );

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#131a2b").text(school.name);
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478").text([school.city, school.state, school.country].filter(Boolean).join(", "));
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a6fba").text("Report Card");
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478");
    doc.text(`Term: ${term?.name ?? "—"}`);
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#131a2b").text(`${student.firstName} ${student.lastName}`);
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478");
    doc.text(`Admission No: ${student.admissionNumber}`);
    doc.text(`Class: ${student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "—"}`);
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#5b6478");
    doc.text("Subject", 50, tableTop, { width: 200 });
    doc.text("Score", 250, tableTop, { width: 70, align: "right" });
    doc.text("Class Avg", 320, tableTop, { width: 70, align: "right" });
    doc.text("Grade", 400, tableTop, { width: 60, align: "right" });
    doc.text("Remark", 460, tableTop, { width: 90, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor("#dfe3ee").stroke();

    let y = tableTop + 22;
    doc.font("Helvetica").fillColor("#131a2b");
    for (const row of subjectRows) {
      doc.fontSize(9);
      doc.text(row.subjectName, 50, y, { width: 200 });
      doc.text(`${row.total}/${row.maxTotal}`, 250, y, { width: 70, align: "right" });
      doc.text(`${row.classAverage}`, 320, y, { width: 70, align: "right" });
      doc.text(row.grade ?? "—", 400, y, { width: 60, align: "right" });
      doc.text(row.remark ?? "—", 460, y, { width: 90, align: "right" });
      y += 20;
    }

    doc.moveTo(50, y + 4).lineTo(550, y + 4).strokeColor("#dfe3ee").stroke();
    y += 16;

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#131a2b");
    doc.text(`Overall average: ${overallAverage ?? "—"}`, 50, y);
    doc.text(`Position: ${position ? `${position} of ${classSize}` : "—"}`, 300, y);
    y += 30;

    if (reportCard.teacherComment) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#131a2b").text("Teacher's comment", 50, y);
      y += 14;
      doc.font("Helvetica").fillColor("#5b6478").text(reportCard.teacherComment, 50, y, { width: 500 });
      y = doc.y + 12;
    }
    if (reportCard.principalComment) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#131a2b").text("Principal's comment", 50, y);
      y += 14;
      doc.font("Helvetica").fillColor("#5b6478").text(reportCard.principalComment, 50, y, { width: 500 });
    }

    doc.end();
  });
}
