"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require";
import { dnsRecordSchema, createDnsRecord, deleteDnsRecord as deleteDnsRecordService } from "@/lib/services/dns-records";
import { initiateDomainOrder } from "@/lib/services/domain-orders";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

export interface DomainActionState {
  status: "idle" | "error";
  message?: string;
}

async function requireOwnedDomain(domainId: string, customerId: string) {
  const domain = await prisma.domain.findFirst({ where: { id: domainId, customerId } });
  if (!domain) throw new Error("Domain not found");
  return domain;
}

export async function addDnsRecord(domainId: string, _prev: DomainActionState, formData: FormData): Promise<DomainActionState> {
  const user = await requireUser();
  await requireOwnedDomain(domainId, user.id);

  const parsed = dnsRecordSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    value: formData.get("value"),
    ttl: formData.get("ttl") || undefined,
    priority: formData.get("priority") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the record fields." };
  }

  try {
    await createDnsRecord(domainId, user.id, parsed.data);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Failed to create DNS record." };
  }

  revalidatePath(`/dashboard/domains/${domainId}`);
  return { status: "idle" };
}

export async function deleteDnsRecord(domainId: string, recordId: string) {
  const user = await requireUser();
  await requireOwnedDomain(domainId, user.id);
  await deleteDnsRecordService(domainId, recordId, user.id);
  revalidatePath(`/dashboard/domains/${domainId}`);
}

export async function setAutoRenew(domainId: string, autoRenew: boolean) {
  const user = await requireUser();
  await requireOwnedDomain(domainId, user.id);
  await prisma.domain.update({ where: { id: domainId }, data: { autoRenew } });
  await recordAuditLog({ actorId: user.id, action: "domain.auto_renew_toggled", resourceType: "Domain", resourceId: domainId, newValue: { autoRenew } });
  revalidatePath(`/dashboard/domains/${domainId}`);
}

/** Starts a paid renewal: creates the order and redirects to payment, same flow as any other purchase. */
export async function requestDomainRenewal(domainId: string, years: number) {
  const user = await requireUser();
  const domain = await requireOwnedDomain(domainId, user.id);

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const appOrigin = process.env.APP_URL ?? `${protocol}://${host}`;

  let authorizationUrl: string;
  try {
    const result = await initiateDomainOrder(user.id, { action: "RENEW", domainId, domainName: domain.name, years }, appOrigin);
    if (!result.authorizationUrl) throw new Error("Payment provider did not return a checkout link.");
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    logger.error("domain_renewal.request_failed", { domainId, error: error instanceof Error ? error.message : "unknown" });
    throw error;
  }

  redirect(authorizationUrl);
}
