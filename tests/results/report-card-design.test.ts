import { describe, it, expect, afterAll } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { loadReportCardDesign } from "@/lib/services/report-card-design";
import { generateReportCardPdfBuffer } from "@/lib/services/report-card-pdf";
import { generatePreschoolReportPdfBuffer } from "@/lib/services/preschool-report-pdf";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool(overrides: Partial<{ brandColor: string | null; reportCardHeaderUrl: string | null; reportCardWatermarkUrl: string | null; reportCardSignatureUrl: string | null; reportCardFooterText: string | null }> = {}) {
  counter += 1;
  const slug = `vitest-reportcarddesign-${Date.now()}-${counter}`;
  return prisma.school.create({ data: { name: slug, slug, status: "ACTIVE", ...overrides } });
}

async function makeStudentFixture(schoolId: string, assessmentMode: "NUMERICAL" | "MILESTONE" = "NUMERICAL") {
  const session = await prisma.academicSession.create({
    data: { schoolId, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });
  const classGroup = await prisma.classGroup.create({ data: { schoolId, name: "Class 1", order: 0, assessmentMode } });
  const classArm = await prisma.classArm.create({ data: { schoolId, classGroupId: classGroup.id, name: "A" } });
  const student = await prisma.student.create({
    data: { schoolId, classArmId: classArm.id, firstName: "Ada", lastName: "Obi", admissionNumber: `RCD-${Date.now()}-${counter}`, status: "ACTIVE" },
  });
  return { term, classArm, student };
}

async function pngDataUrl(color: { r: number; g: number; b: number }) {
  const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: color } }).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

describe("loadReportCardDesign", () => {
  it("returns null buffers and the default accent color when nothing is set", async () => {
    const assets = await loadReportCardDesign({
      reportCardHeaderUrl: null,
      reportCardWatermarkUrl: null,
      reportCardSignatureUrl: null,
      reportCardFooterText: null,
      brandColor: null,
    });
    expect(assets.headerBuffer).toBeNull();
    expect(assets.watermarkBuffer).toBeNull();
    expect(assets.signatureBuffer).toBeNull();
    expect(assets.footerText).toBeNull();
    expect(assets.accentColor).toBe("#1a6fba");
  });

  it("decodes uploaded data: URLs into embeddable buffers and uses the school's brand color", async () => {
    const headerUrl = await pngDataUrl({ r: 10, g: 20, b: 30 });
    const assets = await loadReportCardDesign({
      reportCardHeaderUrl: headerUrl,
      reportCardWatermarkUrl: null,
      reportCardSignatureUrl: null,
      reportCardFooterText: "Discipline · Excellence · Service",
      brandColor: "#ff5500",
    });
    expect(assets.headerBuffer).not.toBeNull();
    expect(assets.footerText).toBe("Discipline · Excellence · Service");
    expect(assets.accentColor).toBe("#ff5500");
  });
});

describe("generateReportCardPdfBuffer", () => {
  it("produces a valid PDF with no design assets set (unchanged default behavior)", async () => {
    const school = await makeSchool();
    const { term, student } = await makeStudentFixture(school.id);

    const buffer = await generateReportCardPdfBuffer(school.id, student.id, term.id);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("produces a valid PDF when a header, watermark, signature and footer are all set", async () => {
    const school = await makeSchool({
      reportCardHeaderUrl: await pngDataUrl({ r: 200, g: 30, b: 30 }),
      reportCardWatermarkUrl: await pngDataUrl({ r: 30, g: 200, b: 30 }),
      reportCardSignatureUrl: await pngDataUrl({ r: 30, g: 30, b: 200 }),
      reportCardFooterText: "Next term begins Monday, 12th January.",
      brandColor: "#112233",
    });
    const { term, student } = await makeStudentFixture(school.id);

    const buffer = await generateReportCardPdfBuffer(school.id, student.id, term.id);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("does not spill onto a spurious blank second page just because a footer is set", async () => {
    // Regression test: pdfkit auto-inserts a new page whenever .text() is
    // asked to draw at/after `page.height - margins.bottom` (its own
    // "does this fit?" check) — drawReportCardFooter must defeat that check
    // rather than silently producing a trailing blank page under the real
    // report card content.
    const school = await makeSchool({ reportCardFooterText: "Next term begins Monday, 12th January 2026." });
    const { term, student } = await makeStudentFixture(school.id);

    const buffer = await generateReportCardPdfBuffer(school.id, student.id, term.id);
    // "/Type /Page" (not "/Pages", the page-tree root) appears once per
    // actual page object in the PDF — a cheap page-count proxy that avoids
    // pulling in a PDF-parsing dependency just for this assertion.
    const pageObjectCount = (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pageObjectCount).toBe(1);
  });
});

describe("generatePreschoolReportPdfBuffer", () => {
  it("produces a valid PDF with no design assets set (unchanged default behavior)", async () => {
    const school = await makeSchool();
    const { term, student } = await makeStudentFixture(school.id, "MILESTONE");

    const buffer = await generatePreschoolReportPdfBuffer(school.id, student.id, term.id);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("produces a valid PDF when a header, watermark, signature and footer are all set", async () => {
    const school = await makeSchool({
      reportCardHeaderUrl: await pngDataUrl({ r: 200, g: 30, b: 30 }),
      reportCardWatermarkUrl: await pngDataUrl({ r: 30, g: 200, b: 30 }),
      reportCardSignatureUrl: await pngDataUrl({ r: 30, g: 30, b: 200 }),
      reportCardFooterText: "Next term begins Monday, 12th January.",
      brandColor: "#112233",
    });
    const { term, student } = await makeStudentFixture(school.id, "MILESTONE");

    const buffer = await generatePreschoolReportPdfBuffer(school.id, student.id, term.id);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });
});
