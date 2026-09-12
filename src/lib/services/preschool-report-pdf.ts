import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { computePreschoolReport, listAssessmentLevels } from "@/lib/services/preschool-results";

/**
 * Renders a Pre-School Milestone Report PDF server-side (pdfkit) — the
 * milestone system's counterpart to generateReportCardPdfBuffer. Milestones/
 * levels/comments are always recomputed live via computePreschoolReport,
 * never cached, same rule as the numerical report card.
 */
export async function generatePreschoolReportPdfBuffer(schoolId: string, studentId: string, termId: string): Promise<Buffer> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  const [{ student, term, report, subjects, summary }, levels] = await Promise.all([
    computePreschoolReport(schoolId, studentId, termId),
    listAssessmentLevels(schoolId),
  ]);
  const labelByLevel = new Map(levels.map((l) => [l.level, l.label]));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#131a2b").text(school.name);
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478").text([school.city, school.state, school.country].filter(Boolean).join(", "));
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a6fba").text("Developmental Milestone Report");
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478");
    doc.text(`Term: ${term?.name ?? "—"}`);
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#131a2b").text(`${student.firstName} ${student.lastName}`);
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478");
    doc.text(`Admission No: ${student.admissionNumber}`);
    doc.text(`Class: ${student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "—"}`);
    doc.moveDown(1.5);

    const left = 50;
    const right = 550;

    function ensureSpace(needed: number) {
      if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
    }

    for (const subject of subjects) {
      ensureSpace(40);
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#131a2b").text(subject.subjectName, left, doc.y);
      doc.moveDown(0.3);

      for (const topic of subject.topics) {
        ensureSpace(20);
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#5b6478").text(`Week ${topic.weekNumber} — ${topic.topicTitle}`, left, doc.y);
        doc.moveDown(0.2);

        for (const m of topic.milestones) {
          ensureSpace(40);
          const y = doc.y;
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#131a2b").text(m.title, left, y, { width: right - left - 150 });
          doc.font("Helvetica").fillColor("#1a6fba").text(labelByLevel.get(m.level) ?? m.level, right - 150, y, { width: 150, align: "right" });
          if (m.comment) {
            doc.fontSize(8).font("Helvetica").fillColor("#5b6478").text(m.comment, left, doc.y, { width: right - left });
          }
          doc.moveDown(0.5);
        }
        doc.moveDown(0.2);
      }
      doc.moveDown(0.5);
    }

    ensureSpace(80);
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#131a2b").text("Summary", left, doc.y);
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#5b6478");
    for (const level of levels) {
      const count = summary[level.level] ?? 0;
      if (count > 0) doc.text(`${level.label}: ${count}`, left);
    }
    doc.moveDown(1);

    if (report.overallComment) {
      ensureSpace(50);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#131a2b").text("Overall developmental comment", left, doc.y);
      doc.moveDown(0.2);
      doc.font("Helvetica").fillColor("#5b6478").text(report.overallComment, left, doc.y, { width: right - left });
      doc.moveDown(1);
    }
    if (report.teacherComment) {
      ensureSpace(40);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#131a2b").text("Class teacher's comment", left, doc.y);
      doc.moveDown(0.2);
      doc.font("Helvetica").fillColor("#5b6478").text(report.teacherComment, left, doc.y, { width: right - left });
      doc.moveDown(1);
    }
    if (report.principalComment) {
      ensureSpace(40);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#131a2b").text("Head of school's comment", left, doc.y);
      doc.moveDown(0.2);
      doc.font("Helvetica").fillColor("#5b6478").text(report.principalComment, left, doc.y, { width: right - left });
    }

    doc.end();
  });
}
