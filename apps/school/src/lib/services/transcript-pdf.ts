import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getStudentAcademicHistory, computeTranscriptSummary } from "@/lib/services/transcripts";

const COLORS = {
  heading: "#131a2b",
  muted: "#5b6478",
  accent: "#1a6fba",
  rule: "#dfe3ee",
  danger: "#c0392b",
};

const PAGE_MARGIN = 50;

function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  return "http://localhost:3001";
}

/**
 * Renders a multi-page academic transcript PDF server-side (pdfkit),
 * pulling every figure live from getStudentAcademicHistory/
 * computeTranscriptSummary (which themselves recompute from Score/
 * AttendanceRecord/ReportCard via computeReportCard) — nothing academic is
 * ever cached on the Transcript row or duplicated into this file. A4,
 * bufferPages so total page count is known for "Page X of Y", a repeated
 * header on every page, and a footer carrying the reference number and an
 * optional QR code linking to the public verification page.
 */
export async function generateTranscriptPdfBuffer(schoolId: string, transcriptId: string): Promise<Buffer> {
  const transcript = await prisma.transcript.findFirst({
    where: { schoolId, id: transcriptId },
    include: { school: true, student: { include: { classArm: { include: { classGroup: true } } } } },
  });
  if (!transcript) throw new Error("Transcript not found");
  const t = transcript;

  const { school, student } = t;
  const { sessions, isIncomplete } = await getStudentAcademicHistory(schoolId, student.id);
  const summary = await computeTranscriptSummary(schoolId, student, sessions);

  const verifyUrl = `${baseUrl()}/verify-transcript?ref=${encodeURIComponent(t.referenceNumber)}`;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 90, margin: 0 }).catch(() => null);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = () => doc.page.margins.left;
    const right = () => doc.page.width - doc.page.margins.right;
    const contentBottom = () => doc.page.height - doc.page.margins.bottom - 12;

    function drawHeader() {
      const top = doc.page.margins.top;
      const l = left();
      const r = right();

      doc.fontSize(13).font("Helvetica-Bold").fillColor(COLORS.heading).text(school.name, l, top, { width: 300 });
      doc.fontSize(8).font("Helvetica").fillColor(COLORS.muted);
      const address = [school.addressLine, school.city, school.state, school.country].filter(Boolean).join(", ");
      if (address) doc.text(address, l, doc.y, { width: 300 });
      const contact = [school.phone, school.email, school.website].filter(Boolean).join("  ·  ");
      if (contact) doc.text(contact, l, doc.y, { width: 300 });

      doc.fontSize(8).font("Helvetica").fillColor(COLORS.muted).text(`Ref: ${t.referenceNumber}`, r - 200, top, { width: 200, align: "right" });
      doc.text(`Generated: ${t.generatedAt.toLocaleDateString()}`, r - 200, top + 12, { width: 200, align: "right" });

      const titleY = top + 46;
      doc.fontSize(12).font("Helvetica-Bold").fillColor(COLORS.accent).text("OFFICIAL ACADEMIC TRANSCRIPT", l, titleY, { width: r - l, align: "center" });

      const ruleY = titleY + 20;
      doc.moveTo(l, ruleY).lineTo(r, ruleY).strokeColor(COLORS.rule).stroke();
      doc.y = ruleY + 12;
      doc.x = l;
    }

    doc.on("pageAdded", drawHeader);
    doc.addPage();

    function ensureSpace(needed: number) {
      if (doc.y + needed > contentBottom()) doc.addPage();
    }

    // ---- Student info (shown once, on the first page) --------------------
    const l0 = left();
    const fullName = `${student.firstName} ${student.otherNames ? student.otherNames + " " : ""}${student.lastName}`.trim();
    doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.heading).text(fullName, l0);
    doc.fontSize(9).font("Helvetica").fillColor(COLORS.muted);
    doc.text(`Admission No: ${student.admissionNumber}`, l0);
    if (student.gender) doc.text(`Gender: ${student.gender === "MALE" ? "Male" : "Female"}`, l0);
    if (student.dateOfBirth) doc.text(`Date of Birth: ${student.dateOfBirth.toLocaleDateString()}`, l0);
    doc.text(`Admission Date: ${student.admissionDate.toLocaleDateString()}`, l0);
    doc.text(`Current Class: ${student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "—"}`, l0);
    doc.text(`Transcript Generated: ${t.generatedAt.toLocaleDateString()}`, l0);
    doc.moveDown(1);

    // ---- Academic history, grouped by session then term ------------------
    for (const session of sessions) {
      ensureSpace(60);
      const l = left();
      const r = right();
      doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.heading).text(session.sessionName, l);
      doc.moveDown(0.3);

      for (const term of session.terms) {
        ensureSpace(50);
        doc.fontSize(10).font("Helvetica-Bold").fillColor(COLORS.accent).text(term.termName, l, doc.y, { continued: true });
        doc.font("Helvetica").fillColor(COLORS.muted).text(`   Class: ${term.classLabel ?? "Not recorded"}`);
        doc.moveDown(0.3);

        if (term.subjectRows.length === 0) {
          doc.fontSize(9).font("Helvetica").fillColor(COLORS.muted).text("No subject scores recorded for this term.", l);
          doc.moveDown(0.5);
          continue;
        }

        ensureSpace(24);
        const tableTop = doc.y;
        doc.fontSize(8).font("Helvetica-Bold").fillColor(COLORS.muted);
        doc.text("Subject", l, tableTop, { width: 180 });
        doc.text("Score", l + 180, tableTop, { width: 60, align: "right" });
        doc.text("Class Avg", l + 240, tableTop, { width: 65, align: "right" });
        doc.text("Grade", l + 305, tableTop, { width: 50, align: "right" });
        doc.text("Remark", l + 355, tableTop, { width: r - (l + 355) });
        doc.moveTo(l, tableTop + 13).lineTo(r, tableTop + 13).strokeColor(COLORS.rule).stroke();
        doc.y = tableTop + 18;

        doc.font("Helvetica").fillColor(COLORS.heading);
        for (const row of term.subjectRows) {
          ensureSpace(16);
          const y = doc.y;
          doc.fontSize(8);
          doc.text(row.subjectName, l, y, { width: 180 });
          doc.text(`${row.total}/${row.maxTotal}`, l + 180, y, { width: 60, align: "right" });
          doc.text(`${row.classAverage}`, l + 240, y, { width: 65, align: "right" });
          doc.text(row.grade ?? "—", l + 305, y, { width: 50, align: "right" });
          doc.text(row.remark ?? "—", l + 355, y, { width: r - (l + 355) });
          doc.y = y + 15;
        }

        ensureSpace(20);
        doc.fontSize(8).font("Helvetica-Bold").fillColor(COLORS.heading);
        doc.text(
          `Term average: ${term.overallAverage ?? "—"}    Position: ${term.position ? `${term.position} of ${term.classSize}` : "—"}    Status: ${term.reportCardStatus}`,
          l,
          doc.y
        );
        doc.moveDown(0.8);
      }
    }

    // ---- Summary -----------------------------------------------------------
    ensureSpace(100);
    const lSum = left();
    doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.heading).text("Transcript Summary", lSum);
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor(COLORS.muted);
    doc.text(`Sessions attended: ${summary.sessionsAttended}`, lSum);
    doc.text(`Classes completed: ${summary.classesCompleted.length > 0 ? summary.classesCompleted.join(", ") : "Not recorded"}`, lSum);
    doc.text(`Years enrolled: ${summary.yearsEnrolled}`, lSum);
    doc.text(
      `Overall performance: ${summary.overallAverage !== null ? `${summary.overallAverage}${summary.performanceRemark ? ` (${summary.performanceRemark})` : ""}` : "—"}`,
      lSum
    );
    if (isIncomplete) {
      doc.moveDown(0.3);
      doc.fillColor(COLORS.danger).text("Academic records may be incomplete for some periods.", lSum);
    }
    doc.moveDown(1.5);

    // ---- Signature placeholder ---------------------------------------------
    ensureSpace(60);
    const lSig = left();
    const sigY = doc.y + 20;
    doc.moveTo(lSig, sigY).lineTo(lSig + 220, sigY).strokeColor(COLORS.heading).stroke();
    doc.fontSize(9).font("Helvetica").fillColor(COLORS.muted).text("Authorized School Official", lSig, sigY + 5);
    doc.text("Name: ______________________   Position: ______________   Date: __________", lSig, sigY + 20);

    // ---- Footer + page numbers, drawn on every buffered page --------------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const r = right();
      const footerY = doc.page.height - doc.page.margins.bottom + 6;
      doc.fontSize(7).font("Helvetica").fillColor(COLORS.muted);
      doc.text(`Generated by Winfield  ·  Ref: ${t.referenceNumber}  ·  Verify at ${baseUrl()}/verify-transcript`, left(), footerY, {
        width: 330,
      });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, r - 150, footerY, { width: 90, align: "right" });
      if (qrBuffer) {
        doc.image(qrBuffer, r - 50, footerY - 38, { width: 34, height: 34 });
      }
    }

    doc.end();
  });
}
