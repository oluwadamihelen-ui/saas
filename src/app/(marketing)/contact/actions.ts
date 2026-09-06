"use server";

import { z } from "zod";
import { getEmailProvider } from "@/lib/providers/registry";
import { logger } from "@/lib/security/logger";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  message: z.string().trim().min(10).max(4000),
});

export interface ContactFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function submitContactForm(_prevState: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your input." };
  }

  try {
    const provider = await getEmailProvider();
    await provider.send({
      to: "sales@forgecart.example",
      subject: `New contact form message from ${parsed.data.name}`,
      html: `<p><strong>From:</strong> ${parsed.data.name} (${parsed.data.email})</p><p>${parsed.data.message}</p>`,
      text: parsed.data.message,
    });
    return { status: "success", message: "Thanks — we'll be in touch within one business day." };
  } catch (error) {
    logger.error("contact.submit_failed", { error: error instanceof Error ? error.message : "unknown" });
    return { status: "error", message: "Something went wrong. Please try again shortly." };
  }
}
