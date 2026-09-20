import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "schoolum_view_as";
const GRANT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET must be set.");
  return value;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

interface ViewAsGrant {
  studentId: string;
  viewerId: string;
  issuedAt: number;
}

/// Signs {studentId, viewerId, issuedAt} into the cookie value so it can't
/// be forged or edited client-side (a viewer swapping in a different
/// studentId would break the signature). The TTL is enforced by re-checking
/// issuedAt on every read below, not just the cookie's own Max-Age — a
/// browser-side expiry is only ever a hint, never trusted as the real
/// enforcement.
export async function grantViewAsStudent(viewerId: string, studentId: string): Promise<void> {
  const issuedAt = Date.now();
  const payload = `${studentId}.${viewerId}.${issuedAt}`;
  const value = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: GRANT_TTL_MS / 1000,
    path: "/",
  });
}

export async function clearViewAsGrant(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/// Reads and verifies the signed cookie — returns null for anything
/// missing, tampered with, or older than GRANT_TTL_MS. Callers still need
/// to re-check authorization (isAuthorizedToViewStudent) against the
/// *current* viewer on every request: this only proves the cookie itself
/// wasn't forged, not that the grant is still valid (e.g. a guardian could
/// have been unlinked from the child since the cookie was issued).
export async function readViewAsGrant(): Promise<ViewAsGrant | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [studentId, viewerId, issuedAtRaw, signature] = parts;
  const payload = `${studentId}.${viewerId}.${issuedAtRaw}`;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > GRANT_TTL_MS) return null;

  return { studentId, viewerId, issuedAt };
}

/// Who's allowed to view a given student's portal without being that
/// student: the school's owner or head of school (any student in their
/// own school), or a guardian actually linked to that specific child.
/// Nobody else — a regular teacher/staff member has no path here, by
/// design (the user explicitly scoped this to "owner and head of school").
export async function isAuthorizedToViewStudent(
  schoolId: string,
  viewer: { id: string; role: string },
  studentId: string
): Promise<boolean> {
  if (viewer.role === "SCHOOL_OWNER" || viewer.role === "PRINCIPAL") {
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    return Boolean(student);
  }
  if (viewer.role === "PARENT") {
    const guardian = await prisma.guardian.findFirst({ where: { schoolId, userId: viewer.id }, select: { id: true } });
    if (!guardian) return false;
    const link = await prisma.studentGuardian.findFirst({ where: { studentId, guardianId: guardian.id } });
    return Boolean(link);
  }
  return false;
}
