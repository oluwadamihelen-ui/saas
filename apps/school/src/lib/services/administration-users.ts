import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const ACCOUNTS_PAGE_SIZE = 20;

/// Every account on the school — staff and portal (parent/student) — unlike
/// listStaff in staff.ts, which deliberately excludes portal accounts since
/// it's the staff directory. This is the broader "every login this school
/// has issued" view the Administration > User > All Users page needs.
export async function listAllAccounts(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where = { schoolId };
  const [accounts, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ACCOUNTS_PAGE_SIZE,
      take: ACCOUNTS_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);
  return { accounts, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / ACCOUNTS_PAGE_SIZE)) };
}

/// Unpaginated, for the Reset Password user picker rather than the All
/// Users table — same "bounded, fine as a plain <select>" reasoning as
/// listAllStaff/listActiveStudentsBrief.
export async function listAllAccountsBrief(schoolId: string) {
  return prisma.user.findMany({
    where: { schoolId },
    select: { id: true, name: true, email: true, role: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function resetUserPassword(schoolId: string, userId: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, schoolId } });
  if (!user) throw new Error("User not found.");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
