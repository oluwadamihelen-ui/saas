"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/require";
import { domainOrderRequestSchema, initiateDomainOrder } from "@/lib/services/domain-orders";
import { logger } from "@/lib/security/logger";

export interface RegisterDomainState {
  status: "idle" | "error";
  message?: string;
}

export async function registerDomain(_prev: RegisterDomainState, formData: FormData): Promise<RegisterDomainState> {
  const user = await requireUser();

  const parsed = domainOrderRequestSchema.safeParse({
    action: "REGISTER",
    domainName: formData.get("domainName"),
    years: formData.get("years") || 1,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the domain name." };
  }

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const appOrigin = process.env.APP_URL ?? `${protocol}://${host}`;

  let authorizationUrl: string;
  try {
    const result = await initiateDomainOrder(user.id, parsed.data, appOrigin);
    if (!result.authorizationUrl) throw new Error("Payment provider did not return a checkout link.");
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't start this registration. Please try again.";
    logger.error("domain_registration.request_failed", { error: message });
    return { status: "error", message };
  }

  redirect(authorizationUrl);
}
