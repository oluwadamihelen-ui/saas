"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { setAllowedDomains } from "@/lib/services/licenses";

export async function updateAllowedDomains(licenseId: string, formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("allowedDomains") ?? "");
  const domains = raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  await setAllowedDomains(licenseId, user.id, domains);
  revalidatePath("/dashboard/licenses");
}
