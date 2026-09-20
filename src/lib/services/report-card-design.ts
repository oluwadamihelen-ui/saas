import "server-only";
import { loadEmbeddableImage } from "@/lib/services/pdf-images";

export interface ReportCardDesignAssets {
  headerBuffer: Buffer | null;
  watermarkBuffer: Buffer | null;
  signatureBuffer: Buffer | null;
  footerText: string | null;
  accentColor: string;
}

const DEFAULT_ACCENT = "#1a6fba";

/// Shared by generateReportCardPdfBuffer and generatePreschoolReportPdfBuffer
/// — both a numerical report card and a pre-school milestone report are
/// "the report card" from a school's point of view, so a design saved once
/// in Settings applies to both.
export async function loadReportCardDesign(school: {
  reportCardHeaderUrl: string | null;
  reportCardWatermarkUrl: string | null;
  reportCardSignatureUrl: string | null;
  reportCardFooterText: string | null;
  brandColor: string | null;
}): Promise<ReportCardDesignAssets> {
  const [headerBuffer, watermarkBuffer, signatureBuffer] = await Promise.all([
    loadEmbeddableImage(school.reportCardHeaderUrl),
    loadEmbeddableImage(school.reportCardWatermarkUrl),
    loadEmbeddableImage(school.reportCardSignatureUrl),
  ]);
  return {
    headerBuffer,
    watermarkBuffer,
    signatureBuffer,
    footerText: school.reportCardFooterText,
    accentColor: school.brandColor || DEFAULT_ACCENT,
  };
}

/// Drawn first, before any text, so page content painted afterward sits on
/// top of it. Sized generously and centered — schools upload whatever
/// crest/motif they like, so this only constrains it to a sensible box
/// rather than assuming an aspect ratio.
export function drawReportCardWatermark(doc: PDFKit.PDFDocument, watermarkBuffer: Buffer | null) {
  if (!watermarkBuffer) return;
  const size = 320;
  const x = (doc.page.width - size) / 2;
  const y = (doc.page.height - size) / 2;
  try {
    doc.save();
    doc.opacity(0.08);
    doc.image(watermarkBuffer, x, y, { fit: [size, size], align: "center", valign: "center" });
    doc.opacity(1);
    doc.restore();
  } catch {
    // A corrupt or unsupported image must never fail the whole report card.
    doc.opacity(1);
  }
}

/// Drawn just inside the bottom margin. pdfkit's .text() auto-inserts a new
/// page whenever the target y sits at or past `page.height - margins.bottom`
/// (its own "does this fit?" check) — placing the footer down there would
/// otherwise silently produce a spurious blank trailing page. Zeroing the
/// bottom margin for the duration of this one call defeats that check
/// without changing where anything else on the page was already drawn.
export function drawReportCardFooter(doc: PDFKit.PDFDocument, footerText: string | null, mutedColor: string) {
  if (!footerText) return;
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.page.height - doc.page.margins.bottom + 8;
  const bottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(8).font("Helvetica-Oblique").fillColor(mutedColor).text(footerText, left, y, { width, align: "center", lineBreak: false });
  doc.page.margins.bottom = bottomMargin;
}
