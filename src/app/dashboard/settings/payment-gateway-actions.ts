"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { saveGatewayCredential, removeGatewayCredential, setActivePaymentProvider } from "@/lib/services/payment-gateways";
import { logAudit } from "@/lib/audit";
import type { PaymentGatewayProvider } from "@/generated/prisma/client";

export interface GatewayFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const providerEnum = z.enum(["PAYSTACK", "FLUTTERWAVE", "KORAPAY"]);

const saveSchema = z.object({
  provider: providerEnum,
  publicKey: z.string().trim().min(1, "Enter the public key"),
  secretKey: z.string().trim().optional().or(z.literal("")),
  webhookSecret: z.string().trim().optional().or(z.literal("")),
  isEnabled: z.literal("on").optional(),
});

export async function saveGatewayCredentialAction(_prev: GatewayFormState, formData: FormData): Promise<GatewayFormState> {
  const user = await requirePermission(PERMISSIONS.PAYMENT_GATEWAYS_MANAGE);
  const parsed = saveSchema.safeParse({
    provider: formData.get("provider"),
    publicKey: formData.get("publicKey"),
    secretKey: formData.get("secretKey") ?? "",
    webhookSecret: formData.get("webhookSecret") ?? "",
    isEnabled: formData.get("isEnabled") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await saveGatewayCredential(user.schoolId, {
      provider: parsed.data.provider,
      publicKey: parsed.data.publicKey,
      secretKey: parsed.data.secretKey || undefined,
      webhookSecret: parsed.data.webhookSecret,
      isEnabled: parsed.data.isEnabled === "on",
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save this gateway." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payment_gateway.saved", resourceType: "PaymentGatewayCredential" });
  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
}

export async function removeGatewayCredentialAction(provider: PaymentGatewayProvider) {
  const user = await requirePermission(PERMISSIONS.PAYMENT_GATEWAYS_MANAGE);
  await removeGatewayCredential(user.schoolId, provider);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payment_gateway.removed", resourceType: "PaymentGatewayCredential" });
  revalidatePath("/dashboard/settings");
}

const activeSchema = z.object({ activeProvider: z.enum(["PAYSTACK", "FLUTTERWAVE", "KORAPAY", ""]) });

export async function setActivePaymentProviderAction(_prev: GatewayFormState, formData: FormData): Promise<GatewayFormState> {
  const user = await requirePermission(PERMISSIONS.PAYMENT_GATEWAYS_MANAGE);
  const parsed = activeSchema.safeParse({ activeProvider: formData.get("activeProvider") ?? "" });
  if (!parsed.success) return { status: "error", message: "Please check your details." };

  try {
    await setActivePaymentProvider(user.schoolId, parsed.data.activeProvider || null);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update the active provider." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payment_gateway.activated", resourceType: "School", resourceId: user.schoolId });
  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
}
