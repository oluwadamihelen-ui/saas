import "server-only";
import { prisma } from "@/lib/db";

export async function listFeeCategories(schoolId: string) {
  return prisma.feeCategory.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

export async function createFeeCategory(schoolId: string, name: string) {
  return prisma.feeCategory.create({ data: { schoolId, name } });
}

export async function deleteFeeCategory(schoolId: string, id: string) {
  const existing = await prisma.feeCategory.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Fee category not found");
  await prisma.feeCategory.delete({ where: { id } });
}

export async function listFeeStructures(schoolId: string, termId?: string) {
  return prisma.feeStructure.findMany({
    where: { schoolId, ...(termId ? { termId } : {}) },
    include: { category: true, classGroup: true, term: true },
    orderBy: [{ term: { startDate: "desc" } }, { category: { name: "asc" } }],
  });
}

export interface FeeStructureInput {
  name: string;
  categoryId: string;
  classGroupId: string | null;
  termId: string;
  amountMinor: number;
}

export async function createFeeStructure(schoolId: string, input: FeeStructureInput) {
  const [category, term] = await Promise.all([
    prisma.feeCategory.findFirst({ where: { id: input.categoryId, schoolId } }),
    prisma.term.findFirst({ where: { id: input.termId, schoolId } }),
  ]);
  if (!category || !term) throw new Error("Select a valid category and term.");
  if (input.classGroupId) {
    const classGroup = await prisma.classGroup.findFirst({ where: { id: input.classGroupId, schoolId } });
    if (!classGroup) throw new Error("Select a valid class.");
  }

  return prisma.feeStructure.create({
    data: {
      schoolId,
      name: input.name,
      categoryId: input.categoryId,
      classGroupId: input.classGroupId,
      termId: input.termId,
      amountMinor: input.amountMinor,
    },
  });
}

export async function deleteFeeStructure(schoolId: string, id: string) {
  const existing = await prisma.feeStructure.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Fee structure not found");
  await prisma.feeStructure.delete({ where: { id } });
}
