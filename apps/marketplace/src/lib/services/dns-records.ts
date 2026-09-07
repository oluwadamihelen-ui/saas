import { z } from "zod";
import { prisma } from "@/lib/db";
import { getDomainProvider } from "@/lib/providers/registry";
import { recordAuditLog } from "@/lib/security/audit";

const RECORD_NAME = /^(@|[a-zA-Z0-9*]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?)$/;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const HOSTNAME = /^[a-zA-Z0-9]([a-zA-Z0-9-.]*[a-zA-Z0-9])?\.?$/;

/**
 * Per-type shape validation -- a record's `value` and whether `priority` is
 * required both depend on `type`, so this is a discriminated superRefine
 * rather than a flat schema. Keeps a customer or admin from ever getting a
 * malformed record persisted (or forwarded to the registrar adapter).
 */
export const dnsRecordSchema = z
  .object({
    type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"]),
    name: z.string().trim().max(255).regex(RECORD_NAME, "Enter a valid record name (e.g. www, @, mail)"),
    value: z.string().trim().min(1).max(2000),
    ttl: z.coerce.number().int().min(60).max(86400).default(3600),
    priority: z.coerce.number().int().min(0).max(65535).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "A" && !IPV4.test(data.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "A records require an IPv4 address" });
    }
    if (data.type === "AAAA" && (!data.value.includes(":") || IPV4.test(data.value))) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "AAAA records require an IPv6 address" });
    }
    if ((data.type === "CNAME" || data.type === "MX" || data.type === "NS") && !HOSTNAME.test(data.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a valid hostname" });
    }
    if ((data.type === "MX" || data.type === "SRV") && data.priority === undefined) {
      ctx.addIssue({ code: "custom", path: ["priority"], message: `${data.type} records require a priority` });
    }
  });

export type DnsRecordInput = z.infer<typeof dnsRecordSchema>;

export async function listDnsRecords(domainId: string) {
  return prisma.dNSRecord.findMany({ where: { domainId }, orderBy: { createdAt: "asc" } });
}

export async function createDnsRecord(domainId: string, actorId: string, input: DnsRecordInput) {
  const domain = await prisma.domain.findUniqueOrThrow({ where: { id: domainId } });
  const provider = await getDomainProvider();
  const { providerRecordId } = await provider.createDNSRecord({
    domain: domain.name,
    type: input.type,
    name: input.name,
    value: input.value,
    ttl: input.ttl,
    priority: input.priority,
  });

  const record = await prisma.dNSRecord.create({
    data: { domainId, type: input.type, name: input.name, value: input.value, ttl: input.ttl, priority: input.priority, providerRecordId },
  });

  await recordAuditLog({
    actorId,
    action: "dns_record.created",
    resourceType: "DNSRecord",
    resourceId: record.id,
    newValue: { domain: domain.name, type: input.type, name: input.name, value: input.value },
  });

  return record;
}

export async function deleteDnsRecord(domainId: string, recordId: string, actorId: string) {
  const record = await prisma.dNSRecord.findFirst({ where: { id: recordId, domainId } });
  if (!record) throw new Error("DNS record not found");

  const domain = await prisma.domain.findUniqueOrThrow({ where: { id: domainId } });
  const provider = await getDomainProvider();
  if (record.providerRecordId) await provider.deleteDNSRecord(domain.name, record.providerRecordId);

  await prisma.dNSRecord.delete({ where: { id: recordId } });

  await recordAuditLog({
    actorId,
    action: "dns_record.deleted",
    resourceType: "DNSRecord",
    resourceId: recordId,
    oldValue: { domain: domain.name, type: record.type, name: record.name, value: record.value },
  });
}
