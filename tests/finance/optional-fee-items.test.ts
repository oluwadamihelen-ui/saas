import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createFeeStructure } from "@/lib/services/fee-structures";
import { generateInvoicesForClass, updateInvoiceItemSelections, getInvoice } from "@/lib/services/invoices";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeFixture(options: { optionalAmountMinor?: number } = {}) {
  counter += 1;
  const slug = `vitest-optionalfees-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 1 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  const category = await prisma.feeCategory.create({ data: { schoolId: school.id, name: "Tuition" } });
  const student = await prisma.student.create({
    data: { schoolId: school.id, firstName: "Ada", lastName: "Obi", admissionNumber: `VITEST-${slug}`, status: "ACTIVE", classArmId: classArm.id },
  });

  const tuition = await createFeeStructure(school.id, {
    name: "Tuition",
    categoryId: category.id,
    classGroupId: null,
    termId: term.id,
    amountMinor: 500000,
    isOptional: false,
  });
  const bus = await createFeeStructure(school.id, {
    name: "School bus",
    categoryId: category.id,
    classGroupId: null,
    termId: term.id,
    amountMinor: options.optionalAmountMinor ?? 100000,
    isOptional: true,
  });

  return { school, term, classArm, student, tuition, bus };
}

describe("generateInvoicesForClass — optional fee items", () => {
  it("includes optional items by default (opt-out, not opt-in) and snapshots isOptional onto InvoiceItem", async () => {
    const { school, term, classArm, student } = await makeFixture();

    await generateInvoicesForClass(school.id, classArm.id, term.id);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { studentId_termId: { studentId: student.id, termId: term.id } },
      include: { items: true },
    });
    expect(invoice.totalMinor).toBe(600000);
    const busItem = invoice.items.find((i) => i.description === "School bus")!;
    expect(busItem.isOptional).toBe(true);
    expect(busItem.isIncluded).toBe(true);
    const tuitionItem = invoice.items.find((i) => i.description === "Tuition")!;
    expect(tuitionItem.isOptional).toBe(false);
    expect(tuitionItem.isIncluded).toBe(true);
  });
});

describe("updateInvoiceItemSelections", () => {
  it("unticking an optional item recomputes subtotal/total and keeps the row (soft toggle)", async () => {
    const { school, term, classArm, student } = await makeFixture();
    await generateInvoicesForClass(school.id, classArm.id, term.id);
    const invoice = await getInvoice(school.id, (await prisma.invoice.findUniqueOrThrow({ where: { studentId_termId: { studentId: student.id, termId: term.id } } })).id);
    const busItem = invoice!.items.find((i) => i.description === "School bus")!;

    const updated = await updateInvoiceItemSelections(school.id, invoice!.id, [{ itemId: busItem.id, included: false }]);

    expect(updated.totalMinor).toBe(500000);
    expect(updated.subtotalMinor).toBe(500000);
    const itemAfter = await prisma.invoiceItem.findUniqueOrThrow({ where: { id: busItem.id } });
    expect(itemAfter.isIncluded).toBe(false); // row kept, not deleted

    // Re-ticking flips it back.
    const reIncluded = await updateInvoiceItemSelections(school.id, invoice!.id, [{ itemId: busItem.id, included: true }]);
    expect(reIncluded.totalMinor).toBe(600000);
  });

  it("rejects changes once any payment exists on the invoice", async () => {
    const { school, term, classArm, student } = await makeFixture();
    await generateInvoicesForClass(school.id, classArm.id, term.id);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { studentId_termId: { studentId: student.id, termId: term.id } } });
    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
    const busItem = items.find((i) => i.description === "School bus")!;
    await prisma.payment.create({
      data: { schoolId: school.id, invoiceId: invoice.id, amountMinor: 100000, method: "BANK_TRANSFER", status: "PENDING", reference: `vitest-${invoice.id}` },
    });

    await expect(updateInvoiceItemSelections(school.id, invoice.id, [{ itemId: busItem.id, included: false }])).rejects.toThrow(/payment has started/);
  });

  it("ignores a selection against a non-optional item", async () => {
    const { school, term, classArm, student } = await makeFixture();
    await generateInvoicesForClass(school.id, classArm.id, term.id);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { studentId_termId: { studentId: student.id, termId: term.id } } });
    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
    const tuitionItem = items.find((i) => i.description === "Tuition")!;

    const updated = await updateInvoiceItemSelections(school.id, invoice.id, [{ itemId: tuitionItem.id, included: false }]);

    expect(updated.totalMinor).toBe(600000); // unchanged — non-optional items can't be toggled
    const itemAfter = await prisma.invoiceItem.findUniqueOrThrow({ where: { id: tuitionItem.id } });
    expect(itemAfter.isIncluded).toBe(true);
  });

  it("ignores a selection naming an item id that doesn't belong to this invoice", async () => {
    const { school, term, classArm, student } = await makeFixture();
    await generateInvoicesForClass(school.id, classArm.id, term.id);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { studentId_termId: { studentId: student.id, termId: term.id } } });

    const updated = await updateInvoiceItemSelections(school.id, invoice.id, [{ itemId: "not-a-real-item-id", included: false }]);

    expect(updated.totalMinor).toBe(600000);
  });
});
