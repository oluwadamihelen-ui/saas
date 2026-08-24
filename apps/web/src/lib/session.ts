import { auth } from "./auth";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const user = session?.user as { id?: string; status?: string } | undefined;
  if (!user?.id) throw new Error("UNAUTHORIZED");
  // A suspended account's still-valid JWT would otherwise keep working
  // until it expires — this closes that gap on every request, not just
  // at the next login (auth.ts's authorize() already blocks login itself).
  if (user.status !== "ACTIVE") throw new Error("SUSPENDED");
  return user.id;
}

export async function requireAdmin(): Promise<string> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; status?: string } | undefined;
  if (!user?.id) throw new Error("UNAUTHORIZED");
  if (user.status !== "ACTIVE") throw new Error("SUSPENDED");
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user.id;
}
