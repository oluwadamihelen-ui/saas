import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { getStudentAcademicHistory, computeTranscriptSummary } from "@/lib/services/transcripts";
import { calculateAge } from "@/lib/utils";

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

/// School logos and student photos are both stored as data: URLs (this app
/// has no external object storage) — decode straight to a Buffer. Returns
/// null for anything else (unset, or a future non-data URL scheme) so the
/// caller can just skip drawing it.
function dataUrlToBuffer(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return null;
  try {
    return Buffer.from(dataUrl.slice(comma + 1), "base64");
  } catch {
    return null;
  }
}

/// pdfkit's doc.image() only understands raw JPEG and PNG bytes — but the
/// logo/photo upload forms also accept WebP (both) and SVG (logo only),
/// per their own "PNG, JPEG or WebP" / accept attributes. Uploading one of
/// those formats used to store fine and preview fine in the browser, but
/// silently produced an empty photo/logo box on the transcript PDF, since
/// generateTranscriptPdfBuffer's own doc.image() try/catch swallowed
/// pdfkit's "Unknown image format" error. Normalizing every image through
/// sharp here (which does understand WebP/SVG/GIF/TIFF, unlike pdfkit)
/// fixes both newly uploaded photos and ones already sitting in the
/// database from before this fix, with no need to re-upload anything.
export async function toEmbeddableImageBuffer(buffer: Buffer): Promise<Buffer | null> {
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (isJpeg || isPng) return buffer;
  try {
    return await sharp(buffer).png().toBuffer();
  } catch {
    return null;
  }
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

  const verifyUrl = `${baseUrl()}/verify-transcript?ref=${encodeURIComponent(t.referenceNumber)}&code=${encodeURIComponent(t.verificationCode)}`;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 90, margin: 0 }).catch(() => null);

  const accentColor = school.brandColor || COLORS.accent;
  const rawLogoBuffer = dataUrlToBuffer(school.logoUrl);
  const rawPhotoBuffer = dataUrlToBuffer(student.photoUrl);
  const logoBuffer = rawLogoBuffer ? await toEmbeddableImageBuffer(rawLogoBuffer) : null;
  const photoBuffer = rawPhotoBuffer ? await toEmbeddableImageBuffer(rawPhotoBuffer) : null;

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
      const textX = logoBuffer ? l + 42 : l;

      if (logoBuffer) {
        // A corrupt or unsupported image (pdfkit's PNG/JPEG decoder is
        // stricter than a browser's) must never fail the whole transcript —
        // just skip the logo and keep going.
        try {
          doc.image(logoBuffer, l, top, { fit: [34, 34], align: "center", valign: "center" });
        } catch {
          /* skip logo */
        }
      }

      doc.fontSize(13).font("Helvetica-Bold").fillColor(COLORS.heading).text(school.name, textX, top, { width: 300 - (textX - l) });
      doc.fontSize(8).font("Helvetica").fillColor(COLORS.muted);
      const address = [school.addressLine, school.city, school.state, school.country].filter(Boolean).join(", ");
      if (address) doc.text(address, textX, doc.y, { width: 300 - (textX - l) });
      const contact = [school.phone, school.email, school.website].filter(Boolean).join("  ·  ");
      if (contact) doc.text(contact, textX, doc.y, { width: 300 - (textX - l) });

      doc.fontSize(8).font("Helvetica").fillColor(COLORS.muted).text(`Ref: ${t.referenceNumber}`, r - 200, top, { width: 200, align: "right" });
      doc.text(`Verification code: ${t.verificationCode}`, r - 200, top + 12, { width: 200, align: "right" });
      doc.text(`Generated: ${t.generatedAt.toLocaleDateString()}`, r - 200, top + 24, { width: 200, align: "right" });

      const titleY = top + 46;
      doc.fontSize(12).font("Helvetica-Bold").fillColor(accentColor).text("OFFICIAL ACADEMIC TRANSCRIPT", l, titleY, { width: r - l, align: "center" });

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
    const r0 = right();
    const infoTop = doc.y;
    const photoBoxW = 66;
    const photoBoxH = 84;
    const textWidth = photoBuffer ? r0 - l0 - photoBoxW - 14 : r0 - l0;

    const fullName = `${student.firstName} ${student.otherNames ? student.otherNames + " " : ""}${student.lastName}`.trim();
    doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.heading).text(fullName, l0, infoTop, { width: textWidth });
    doc.fontSize(9).font("Helvetica").fillColor(COLORS.muted);
    doc.text(`Admission No: ${student.admissionNumber}`, l0, doc.y, { width: textWidth });
    if (student.gender) doc.text(`Gender: ${student.gender === "MALE" ? "Male" : "Female"}`, l0, doc.y, { width: textWidth });
    if (student.dateOfBirth) {
      const age = calculateAge(student.dateOfBirth);
      doc.text(`Date of Birth: ${student.dateOfBirth.toLocaleDateString()} (Age: ${age})`, l0, doc.y, { width: textWidth });
    }
    const address = [student.addressLine, student.city, student.state].filter(Boolean).join(", ");
    if (address) doc.text(`Address: ${address}`, l0, doc.y, { width: textWidth });
    doc.text(`Admission Date: ${student.admissionDate.toLocaleDateString()}`, l0, doc.y, { width: textWidth });
    doc.text(`Current Class: ${student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "—"}`, l0, doc.y, { width: textWidth });
    doc.text(`Transcript Generated: ${t.generatedAt.toLocaleDateString()}`, l0, doc.y, { width: textWidth });
    const textBottom = doc.y;

    if (photoBuffer) {
      const boxX = r0 - photoBoxW;
      doc.rect(boxX, infoTop, photoBoxW, photoBoxH).strokeColor(COLORS.rule).stroke();
      try {
        doc.image(photoBuffer, boxX, infoTop, { fit: [photoBoxW, photoBoxH], align: "center", valign: "center" });
      } catch {
        // Corrupt or unsupported image data — leave the bordered slot empty
        // rather than failing the whole transcript.
      }
    }

    doc.y = Math.max(textBottom, photoBuffer ? infoTop + photoBoxH : textBottom);
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
        doc.fontSize(10).font("Helvetica-Bold").fillColor(accentColor).text(term.termName, l, doc.y, { continued: true });
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
        doc.text("Grade", l + 305, tableTop, { width: 40, align: "right" });
        doc.text("Remark", l + 353, tableTop, { width: r - (l + 353) });
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
          doc.text(row.grade ?? "—", l + 305, y, { width: 40, align: "right" });
          doc.text(row.remark ?? "—", l + 353, y, { width: r - (l + 353) });
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
      doc.text(`Generated by Schoolum  ·  Ref: ${t.referenceNumber}  ·  Verify at ${baseUrl()}/verify-transcript`, left(), footerY, {
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
