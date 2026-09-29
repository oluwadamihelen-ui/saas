"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { saveProviderKeys, setActiveProvider } from "@/lib/services/payment-settings";
import type { PaymentProviderType } from "@/generated/prisma/enums";

const keysSchema = z.object({
  provider: z.enum(["PAYSTACK", "FLUTTERWAVE", "KORAPAY"]),
  publicKey: z.string().trim().max(300),
  secretKey: z.string().trim().max(300).optional(),
  webhookSecret: z.string().trim().max(300).optional(),
});

export interface PaymentKeysFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function savePaymentProviderKeysAction(_prev: PaymentKeysFormState, formData: FormData): Promise<PaymentKeysFormState> {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const parsed = keysSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await saveProviderKeys(user.hotelId, user.id, {
      provider: parsed.data.provider,
      publicKey: parsed.data.publicKey,
      secretKey: parsed.data.secretKey || undefined,
      webhookSecret: parsed.data.webhookSecret || undefined,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to save keys." };
  }

  revalidatePath("/app/settings");
  return { status: "success", message: "Keys saved." };
}

export interface SetActiveProviderResult {
  status: "success" | "error";
  message?: string;
}

export async function setActivePaymentProviderAction(provider: PaymentProviderType | "NONE"): Promise<SetActiveProviderResult> {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  try {
    await setActiveProvider(user.hotelId, user.id, provider === "NONE" ? null : provider);
    revalidatePath("/app/settings");
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to update active provider." };
  }
}
