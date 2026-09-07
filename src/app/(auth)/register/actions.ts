"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/security/logger";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  company: z.string().trim().max(200).optional(),
  accountType: z.enum(["CUSTOMER", "DEVELOPER"]).default("CUSTOMER"),
});

export interface RegisterState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function registerCustomer(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    company: formData.get("company") || undefined,
    accountType: formData.get("accountType") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { name, email, password, company, accountType } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { status: "error", message: "An account with this email already exists." };
  }

  const role = await prisma.role.findUnique({ where: { key: accountType } });
  if (!role) {
    logger.error("register.missing_role", { role: accountType });
    return { status: "error", message: "Unable to create account right now. Please try again shortly." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { name, email, passwordHash, company, roleId: role.id, status: "ACTIVE" },
  });

  logger.info("register.success", { email, accountType });

  return { status: "success" };
}
