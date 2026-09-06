"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getDomainProvider } from "@/lib/providers/registry";
import { dnsRecordSchema, createDnsRecord, deleteDnsRecord } from "@/lib/services/dns-records";
import { recordAuditLog } from "@/lib/security/audit";
import { notifyUser } from "@/lib/services/notifications";

export interface DomainActionState {
  status: "idle" | "error";
  message?: string;
}

export async function addDnsRecordAdmin(domainId: string, _prev: DomainActionState, formData: FormData): Promise<DomainActionState> {
  const admin = await requirePermission(PERMISSIONS.DOMAINS_MANAGE);

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
    await createDnsRecord(domainId, admin.id, parsed.data);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Failed to create DNS record." };
  }

  revalidatePath(`/admin/domains/${domainId}`);
  return { status: "idle" };
}

export async function deleteDnsRecordAdmin(domainId: string, recordId: string) {
  const admin = await requirePermission(PERMISSIONS.DOMAINS_MANAGE);
  await deleteDnsRecord(domainId, recordId, admin.id);
  revalidatePath(`/admin/domains/${domainId}`);
}

/**
 * Admin-initiated renewal outside the customer billing flow -- a support
 * action (e.g. correcting a lapsed auto-renew, goodwill extension), not a
 * purchase. Still books a DomainOrder row so the ledger reflects that the
 * domain's expiry changed and why (the audit log entry), but no Order or
 * Payment is created.
 */
export async function forceRenewDomainAdmin(domainId: string, years: number) {
  const admin = await requirePermission(PERMISSIONS.DOMAINS_MANAGE);
  const domain = await prisma.domain.findUniqueOrThrow({ where: { id: domainId } });

  const provider = await getDomainProvider();
  const quote = await provider.getPricingQuote(domain.name, years, "renew");
  const { expiresAt } = await provider.renewDomain(domain.name, years, domain.expiresAt?.toISOString());

  await prisma.domain.update({ where: { id: domainId }, data: { status: "ACTIVE", expiresAt: new Date(expiresAt) } });
  await prisma.domainOrder.create({
    data: { domainId, domainName: domain.name, action: "RENEW", years, providerCost: quote.price, customerPrice: 0, status: "COMPLETED" },
  });
  await recordAuditLog({
    actorId: admin.id,
    action: "domain.force_renewed",
    resourceType: "Domain",
    resourceId: domainId,
    newValue: { years, expiresAt, byAdmin: true },
  });
  await notifyUser(domain.customerId, {
    type: "domain.renewed",
    title: "Domain renewed",
    message: `${domain.name} has been renewed through ${new Date(expiresAt).toDateString()} by our team.`,
  });

  revalidatePath(`/admin/domains/${domainId}`);
}

export async function setAutoRenewAdmin(domainId: string, autoRenew: boolean) {
  const admin = await requirePermission(PERMISSIONS.DOMAINS_MANAGE);
  await prisma.domain.update({ where: { id: domainId }, data: { autoRenew } });
  await recordAuditLog({ actorId: admin.id, action: "domain.auto_renew_toggled", resourceType: "Domain", resourceId: domainId, newValue: { autoRenew, byAdmin: true } });
  revalidatePath(`/admin/domains/${domainId}`);
}
