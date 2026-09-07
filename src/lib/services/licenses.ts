import { z } from "zod";
import { prisma } from "@/lib/db";

export const verifyLicenseSchema = z.object({
  licenseKey: z.string().trim().min(1, "licenseKey is required"),
  domain: z.string().trim().max(255).optional(),
});

export interface LicenseVerificationResult {
  valid: boolean;
  reason?: string;
  application?: { id: string; name: string; slug: string };
  status?: string;
  expiresAt?: string | null;
  requiresOnlineVerification?: boolean;
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

/**
 * Verifies a license key the way a deployed customer application would call
 * home: checks status/expiry, and -- if the license has allowedDomains set
 * (empty means unrestricted) -- that the calling domain is one of them.
 * Tracks lastVerifiedAt/verificationCount on every successful check so
 * usage is visible to the customer and to support.
 */
export async function verifyLicense(licenseKey: string, domain?: string): Promise<LicenseVerificationResult> {
  const license = await prisma.applicationLicense.findUnique({
    where: { licenseKey },
    include: { application: true },
  });
  if (!license) return { valid: false, reason: "License key not found." };

  if (license.status !== "ACTIVE") {
    return { valid: false, reason: `This license is ${license.status.toLowerCase()}.`, status: license.status };
  }
  if (license.expiresAt && license.expiresAt < new Date()) {
    return { valid: false, reason: "This license has expired.", status: license.status, expiresAt: license.expiresAt.toISOString() };
  }
  if (license.allowedDomains.length > 0) {
    const normalized = domain ? normalizeDomain(domain) : null;
    if (!normalized || !license.allowedDomains.includes(normalized)) {
      return { valid: false, reason: "This license is not authorized for that domain.", status: license.status };
    }
  }

  await prisma.applicationLicense.update({
    where: { id: license.id },
    data: { lastVerifiedAt: new Date(), verificationCount: { increment: 1 } },
  });

  return {
    valid: true,
    application: { id: license.application.id, name: license.application.name, slug: license.application.slug },
    status: license.status,
    expiresAt: license.expiresAt?.toISOString() ?? null,
    requiresOnlineVerification: license.requiresOnlineVerification,
  };
}

export async function listLicensesForCustomer(customerId: string) {
  return prisma.applicationLicense.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { application: true },
  });
}

export async function setAllowedDomains(licenseId: string, customerId: string, domains: string[]) {
  const license = await prisma.applicationLicense.findFirst({ where: { id: licenseId, customerId } });
  if (!license) throw new Error("License not found.");
  const normalized = [...new Set(domains.map(normalizeDomain).filter(Boolean))];
  return prisma.applicationLicense.update({ where: { id: licenseId }, data: { allowedDomains: normalized } });
}
