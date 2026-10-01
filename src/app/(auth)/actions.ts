"use server";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema, fieldErrors, type ActionState } from "@/lib/validation";
import { DEFAULT_CHECKLIST } from "@/lib/engine/guardrail";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 60 * 60_000).ok) return { error: "Too many sign-ups from this network. Try again later." };
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { name, email, password } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) return { fields: { email: "An account with this email already exists" } };
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  await prisma.checklist.create({ data: { userId: user.id, items: DEFAULT_CHECKLIST } });
  await signIn("credentials", { email, password, redirectTo: "/onboarding" });
  return { ok: true };
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!rateLimit(`login-ip:${ip}`, 30, 10 * 60_000).ok) return { error: "Too many attempts. Please wait a few minutes." };
  const callback = String(fd.get("callbackUrl") ?? "/dashboard");
  const safe = callback.startsWith("/") && !callback.startsWith("//") ? callback : "/dashboard";
  try {
    await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirectTo: safe });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Incorrect email or password." };
    throw e; // redirects must propagate
  }
  redirect(safe);
}
