import { auth } from "./auth";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error("UNAUTHORIZED");
  return userId;
}

export async function requireAdmin(): Promise<string> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) throw new Error("UNAUTHORIZED");
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user.id;
}
