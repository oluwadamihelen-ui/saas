import { describe, it, expect, afterAll } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { generateTranscript } from "@/lib/services/transcripts";
import { generateTranscriptPdfBuffer, toEmbeddableImageBuffer } from "@/lib/services/transcript-pdf";
import { createTestSchool, cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

/// A tiny 1x1 red pixel, re-encoded into each format under test — real
/// image bytes, not hand-typed magic numbers, so a codec-level parsing
/// failure would show up as a thrown error here just as it would in
/// production.
async function pixelAs(format: "png" | "jpeg" | "webp"): Promise<Buffer> {
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer();
  if (format === "png") return png;
  return sharp(png)[format]().toBuffer();
}

describe("toEmbeddableImageBuffer", () => {
  it("passes PNG and JPEG bytes through unchanged — pdfkit already understands them", async () => {
    const png = await pixelAs("png");
    const jpeg = await pixelAs("jpeg");
    expect(await toEmbeddableImageBuffer(png)).toBe(png);
    expect(await toEmbeddableImageBuffer(jpeg)).toBe(jpeg);
  });

  it("converts WebP bytes (which pdfkit's doc.image() cannot read) to a PNG pdfkit can embed", async () => {
    const webp = await pixelAs("webp");
    const converted = await toEmbeddableImageBuffer(webp);
    expect(converted).not.toBeNull();
    // PNG magic bytes: 0x89 'P' 'N' 'G'
    expect(converted![0]).toBe(0x89);
    expect(converted![1]).toBe(0x50);
    expect(converted![2]).toBe(0x4e);
    expect(converted![3]).toBe(0x47);
  });

  it("returns null for bytes no codec can decode, rather than throwing", async () => {
    expect(await toEmbeddableImageBuffer(Buffer.from("not an image"))).toBeNull();
  });
});

let counter = 0;
async function makeSchoolWithTranscript(photoFormat: "png" | "jpeg" | "webp") {
  counter += 1;
  const { school } = await createTestSchool({ planTier: "PROFESSIONAL" });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_OWNER", name: "Owner" } });
  const staff = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `vitest-tpdf-${Date.now()}-${counter}@vitest.local`, passwordHash: "x", name: "Staff" },
  });
  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });
  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: `vitest-tpdf-${Date.now()}-${counter}` } });
  const component = await prisma.assessmentComponent.create({ data: { schoolId: school.id, name: "Exam", maxScore: 100, order: 0 } });

  const photoBytes = await pixelAs(photoFormat);
  const mime = photoFormat === "jpeg" ? "image/jpeg" : `image/${photoFormat}`;
  const student = await prisma.student.create({
    data: {
      schoolId: school.id,
      firstName: "Ada",
      lastName: "Lovelace",
      admissionNumber: `vitest-tpdf-${Date.now()}-${counter}`,
      admissionDate: new Date("2025-09-01"),
      status: "ACTIVE",
      photoUrl: `data:${mime};base64,${photoBytes.toString("base64")}`,
    },
  });
  await prisma.score.create({
    data: { schoolId: school.id, studentId: student.id, subjectId: subject.id, termId: term.id, componentId: component.id, value: 88, enteredById: staff.id },
  });

  const transcript = await generateTranscript(school.id, student.id, staff.id);
  return { school, transcript };
}

describe("generateTranscriptPdfBuffer with a non-JPEG/PNG student photo", () => {
  it("still produces a valid PDF when the photo was uploaded as WebP", async () => {
    const { school, transcript } = await makeSchoolWithTranscript("webp");
    const pdf = await generateTranscriptPdfBuffer(school.id, transcript.id);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("still produces a valid PDF for an ordinary JPEG photo (unaffected control case)", async () => {
    const { school, transcript } = await makeSchoolWithTranscript("jpeg");
    const pdf = await generateTranscriptPdfBuffer(school.id, transcript.id);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
