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
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { name, email, password, company } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { status: "error", message: "An account with this email already exists." };
  }

  const customerRole = await prisma.role.findUnique({ where: { key: "CUSTOMER" } });
  if (!customerRole) {
    logger.error("register.missing_role", { role: "CUSTOMER" });
    return { status: "error", message: "Unable to create account right now. Please try again shortly." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { name, email, passwordHash, company, roleId: customerRole.id, status: "ACTIVE" },
  });

  logger.info("register.success", { email });

  return { status: "success" };
}
