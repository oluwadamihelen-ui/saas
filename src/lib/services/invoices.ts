import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { notifyInvoiceIssued } from "@/lib/services/notifications";

async function nextInvoiceNumber(schoolId: string) {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({ where: { schoolId } });
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

/// Rolls every FeeStructure applicable to a student's class (or "all
/// classes") for a term into one Invoice with one InvoiceItem per
/// structure. Skips students who already have a non-duplicate invoice for
/// that term (the unique constraint is the source of truth; this just
/// avoids a noisy per-student error for the common re-run case).
export async function generateInvoicesForClass(schoolId: string, classArmId: string, termId: string) {
  const [classArm, term] = await Promise.all([
    prisma.classArm.findFirst({ where: { id: classArmId, schoolId } }),
    prisma.term.findFirst({ where: { id: termId, schoolId } }),
  ]);
  if (!classArm || !term) throw new Error("Class or term not found.");

  const [students, feeStructures] = await Promise.all([
    prisma.student.findMany({ where: { schoolId, classArmId, status: "ACTIVE" } }),
    prisma.feeStructure.findMany({
      where: { schoolId, termId, OR: [{ classGroupId: classArm.classGroupId }, { classGroupId: null }] },
    }),
  ]);

  if (feeStructures.length === 0) throw new Error("No fee structures apply to this class and term yet.");

  const dueDate = new Date(term.startDate);
  dueDate.setDate(dueDate.getDate() + 14);
  const subtotalMinor = feeStructures.reduce((sum, f) => sum + f.amountMinor, 0);

  let created = 0;
  let skipped = 0;
  for (const student of students) {
    const existing = await prisma.invoice.findUnique({ where: { studentId_termId: { studentId: student.id, termId } } });
    if (existing) {
      skipped += 1;
      continue;
    }

    const invoice = await prisma.invoice.create({
      data: {
        schoolId,
        studentId: student.id,
        termId,
        invoiceNumber: await nextInvoiceNumber(schoolId),
        subtotalMinor,
        totalMinor: subtotalMinor,
        dueDate,
        payToken: crypto.randomBytes(20).toString("hex"),
        items: { create: feeStructures.map((f) => ({ feeStructureId: f.id, description: f.name, amountMinor: f.amountMinor })) },
      },
    });
    await notifyInvoiceIssued(schoolId, invoice.id);
    created += 1;
  }

  return { created, skipped };
}

export interface InvoiceFilters {
  classArmId?: string;
  termId?: string;
  status?: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  page?: number;
}

const INVOICE_PAGE_SIZE = 20;

export async function listInvoices(schoolId: string, filters: InvoiceFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.InvoiceWhereInput = {
    schoolId,
    ...(filters.termId ? { termId: filters.termId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.classArmId ? { student: { classArmId: filters.classArmId } } : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { student: { include: { classArm: { include: { classGroup: true } } } }, payments: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * INVOICE_PAGE_SIZE,
      take: INVOICE_PAGE_SIZE,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { invoices, total, page, pageCount: Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE)) };
}

export async function listInvoicesForStudent(schoolId: string, studentId: string) {
  return prisma.invoice.findMany({
    where: { schoolId, studentId },
    include: { term: true, payments: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoice(schoolId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { schoolId, id },
    include: {
      student: { include: { classArm: { include: { classGroup: true } } } },
      term: true,
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getInvoiceByToken(payToken: string) {
  return prisma.invoice.findUnique({
    where: { payToken },
    include: {
      student: { include: { classArm: { include: { classGroup: true } } } },
      school: true,
      items: true,
      payments: { where: { status: "CONFIRMED" }, orderBy: { createdAt: "desc" } },
    },
  });
}

export function invoiceBalanceMinor(invoice: { totalMinor: number; payments: { status: string; amountMinor: number }[] }) {
  const paid = invoice.payments.filter((p) => p.status === "CONFIRMED").reduce((sum, p) => sum + p.amountMinor, 0);
  return Math.max(0, invoice.totalMinor - paid);
}

/// Recomputes and persists status from confirmed payments — status is
/// never set directly by a caller, only derived here, so it can't drift
/// from what was actually paid.
export async function recalculateInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  if (invoice.status === "CANCELLED") return invoice;

  const balance = invoiceBalanceMinor(invoice);
  const status = balance <= 0 ? "PAID" : balance < invoice.totalMinor ? "PARTIALLY_PAID" : "ISSUED";

  return prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
}
