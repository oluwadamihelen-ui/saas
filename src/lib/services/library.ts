import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const BOOK_PAGE_SIZE = 20;

/// availableCopies is derived (totalCopies minus currently-ISSUED loans)
/// rather than stored, so it can't drift out of sync with the loan ledger.
export async function listBooks(schoolId: string, search: string | undefined, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.BookWhereInput = {
    schoolId,
    ...(search
      ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { author: { contains: search, mode: "insensitive" } }] }
      : {}),
  };
  const [books, total] = await Promise.all([
    prisma.book.findMany({
      where,
      include: { _count: { select: { loans: { where: { status: "ISSUED" } } } } },
      orderBy: { title: "asc" },
      skip: (currentPage - 1) * BOOK_PAGE_SIZE,
      take: BOOK_PAGE_SIZE,
    }),
    prisma.book.count({ where }),
  ]);
  return {
    books: books.map((b) => ({ ...b, availableCopies: b.totalCopies - b._count.loans })),
    total,
    page: currentPage,
    pageCount: Math.max(1, Math.ceil(total / BOOK_PAGE_SIZE)),
  };
}

export async function listAllBooks(schoolId: string) {
  const books = await prisma.book.findMany({
    where: { schoolId },
    include: { _count: { select: { loans: { where: { status: "ISSUED" } } } } },
    orderBy: { title: "asc" },
  });
  return books.map((b) => ({ ...b, availableCopies: b.totalCopies - b._count.loans }));
}

export interface BookInput {
  title: string;
  author: string;
  isbn?: string | null;
  category?: string | null;
  totalCopies: number;
}

export async function createBook(schoolId: string, input: BookInput) {
  return prisma.book.create({ data: { schoolId, ...input } });
}

const LOAN_PAGE_SIZE = 20;

export async function listBookLoans(schoolId: string, status: "ISSUED" | "RETURNED" | "LOST" | undefined, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.BookLoanWhereInput = { schoolId, ...(status ? { status } : {}) };
  const [loans, total] = await Promise.all([
    prisma.bookLoan.findMany({
      where,
      include: { book: true, borrowerStudent: true, borrowerUser: true, issuedBy: true },
      orderBy: { issuedAt: "desc" },
      skip: (currentPage - 1) * LOAN_PAGE_SIZE,
      take: LOAN_PAGE_SIZE,
    }),
    prisma.bookLoan.count({ where }),
  ]);
  return { loans, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / LOAN_PAGE_SIZE)) };
}

export interface IssueLoanInput {
  bookId: string;
  borrowerStudentId?: string | null;
  borrowerUserId?: string | null;
  dueAt: Date;
}

/// Exactly one of borrowerStudentId/borrowerUserId must be set — this is
/// the one place that's checked, since the schema itself allows both to be
/// null or (in theory) both set.
export async function issueLoan(schoolId: string, issuedById: string, input: IssueLoanInput) {
  const hasStudent = Boolean(input.borrowerStudentId);
  const hasStaff = Boolean(input.borrowerUserId);
  if (hasStudent === hasStaff) {
    throw new Error("Choose exactly one borrower — a student or a staff member.");
  }

  const book = await prisma.book.findFirst({
    where: { id: input.bookId, schoolId },
    include: { _count: { select: { loans: { where: { status: "ISSUED" } } } } },
  });
  if (!book) throw new Error("Book not found.");
  if (book._count.loans >= book.totalCopies) throw new Error("No copies of this book are available.");

  return prisma.bookLoan.create({
    data: {
      schoolId,
      bookId: input.bookId,
      borrowerStudentId: input.borrowerStudentId || null,
      borrowerUserId: input.borrowerUserId || null,
      issuedById,
      dueAt: input.dueAt,
    },
  });
}

export async function returnLoan(schoolId: string, id: string) {
  const loan = await prisma.bookLoan.findFirst({ where: { schoolId, id } });
  if (!loan) throw new Error("Loan not found.");
  if (loan.status !== "ISSUED") throw new Error("This loan is already closed.");
  return prisma.bookLoan.update({ where: { id }, data: { status: "RETURNED", returnedAt: new Date() } });
}

export async function markLoanLost(schoolId: string, id: string) {
  const loan = await prisma.bookLoan.findFirst({ where: { schoolId, id } });
  if (!loan) throw new Error("Loan not found.");
  if (loan.status !== "ISSUED") throw new Error("This loan is already closed.");
  return prisma.bookLoan.update({ where: { id }, data: { status: "LOST" } });
}
