"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createBook, issueLoan, returnLoan, markLoanLost } from "@/lib/services/library";
import { logAudit } from "@/lib/audit";

export interface LibraryFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const bookSchema = z.object({
  title: z.string().trim().min(1, "Enter a title"),
  author: z.string().trim().min(1, "Enter an author"),
  isbn: z.string().trim().optional().or(z.literal("")),
  category: z.string().trim().optional().or(z.literal("")),
  totalCopies: z.coerce.number().int().positive("Enter at least 1 copy"),
});

export async function createBookAction(_prev: LibraryFormState, formData: FormData): Promise<LibraryFormState> {
  const user = await requirePermission(PERMISSIONS.LIBRARY_MANAGE);
  const parsed = bookSchema.safeParse({
    title: formData.get("title"),
    author: formData.get("author"),
    isbn: formData.get("isbn") ?? "",
    category: formData.get("category") ?? "",
    totalCopies: formData.get("totalCopies"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  await createBook(user.schoolId, {
    title: parsed.data.title,
    author: parsed.data.author,
    isbn: parsed.data.isbn || null,
    category: parsed.data.category || null,
    totalCopies: parsed.data.totalCopies,
  });
  revalidatePath("/dashboard/library");
  return { status: "success" };
}

const loanSchema = z.object({
  bookId: z.string().trim().min(1, "Choose a book"),
  borrowerType: z.enum(["student", "staff"]),
  borrowerId: z.string().trim().min(1, "Choose a borrower"),
  dueAt: z.coerce.date(),
});

export async function issueLoanAction(_prev: LibraryFormState, formData: FormData): Promise<LibraryFormState> {
  const user = await requirePermission(PERMISSIONS.LIBRARY_MANAGE);
  const parsed = loanSchema.safeParse({
    bookId: formData.get("bookId"),
    borrowerType: formData.get("borrowerType"),
    borrowerId: formData.get("borrowerId"),
    dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await issueLoan(user.schoolId, user.id, {
      bookId: parsed.data.bookId,
      borrowerStudentId: parsed.data.borrowerType === "student" ? parsed.data.borrowerId : null,
      borrowerUserId: parsed.data.borrowerType === "staff" ? parsed.data.borrowerId : null,
      dueAt: parsed.data.dueAt,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not issue this loan." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "library.loan_issued", resourceType: "BookLoan" });
  revalidatePath("/dashboard/library/loans");
  revalidatePath("/dashboard/library");
  return { status: "success" };
}

export async function returnLoanAction(id: string) {
  const user = await requirePermission(PERMISSIONS.LIBRARY_MANAGE);
  await returnLoan(user.schoolId, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "library.loan_returned", resourceType: "BookLoan", resourceId: id });
  revalidatePath("/dashboard/library/loans");
  revalidatePath("/dashboard/library");
}

export async function markLoanLostAction(id: string) {
  const user = await requirePermission(PERMISSIONS.LIBRARY_MANAGE);
  await markLoanLost(user.schoolId, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "library.loan_marked_lost", resourceType: "BookLoan", resourceId: id });
  revalidatePath("/dashboard/library/loans");
  revalidatePath("/dashboard/library");
}
