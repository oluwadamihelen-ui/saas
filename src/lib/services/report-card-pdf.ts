import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { computeReportCard } from "@/lib/services/results";
import { loadReportCardDesign, drawReportCardWatermark, drawReportCardFooter } from "@/lib/services/report-card-design";

/**
 * Renders a report card PDF server-side (pdfkit). Subject totals/grades and
 * class position are always recomputed from live Score rows via
 * computeReportCard — never cached on the ReportCard row — so a PDF
 * downloaded after a late score correction is always current.
 *
 * The header/watermark/signature/footer/accent color are all optional, set
 * once by the school in Settings → Report card design (see
 * report-card-design.ts) — every report card generated after that pulls
 * them live, so there is nothing to redo per term or per student.
 */
export async function generateReportCardPdfBuffer(schoolId: string, studentId: string, termId: string): Promise<Buffer> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  const { student, term, reportCard, subjectRows, overallAverage, position, classSize } = await computeReportCard(
    schoolId,
    studentId,
    termId
  );
  const design = await loadReportCardDesign(school);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawReportCardWatermark(doc, design.watermarkBuffer);

    if (design.headerBuffer) {
      // A school-designed letterhead already carries the name/crest/colors
      // it wants, so it fully replaces the plain text block below rather
      // than sitting above it.
      try {
        doc.image(design.headerBuffer, 50, doc.y, { fit: [500, 90], align: "center" });
        doc.y += 90;
      } catch {
        // Corrupt/unsupported image — fall through to the plain text header
        // rather than leaving a blank gap where the letterhead should be.
        doc.fontSize(18).font("Helvetica-Bold").fillColor("#131a2b").text(school.name);
        doc.fontSize(9).font("Helvetica").fillColor("#5b6478").text([school.city, school.state, school.country].filter(Boolean).join(", "));
      }
    } else {
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#131a2b").text(school.name);
      doc.fontSize(9).font("Helvetica").fillColor("#5b6478").text([school.city, school.state, school.country].filter(Boolean).join(", "));
    }
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor(design.accentColor).text("Report Card");
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
      y = doc.y + 12;
    }

    if (design.signatureBuffer) {
      try {
        doc.image(design.signatureBuffer, 50, y, { fit: [140, 50] });
        doc.fontSize(8).font("Helvetica").fillColor("#5b6478").text("Authorized signature", 50, y + 54);
      } catch {
        // Corrupt/unsupported image — skip the signature block silently.
      }
    }

    drawReportCardFooter(doc, design.footerText, "#5b6478");

    doc.end();
  });
}
