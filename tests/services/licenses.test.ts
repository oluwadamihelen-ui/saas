import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { verifyLicense, setAllowedDomains } from "@/lib/services/licenses";

const SUFFIX = `lic-${Date.now()}`;

describe("license verification", () => {
  let categoryId: string;
  let applicationId: string;
  let customerId: string;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const category = await prisma.category.create({ data: { name: `License Test ${SUFFIX}`, slug: `license-test-${SUFFIX}` } });
    categoryId = category.id;
    const customer = await prisma.user.create({ data: { name: "License Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" } });
    customerId = customer.id;
    const application = await prisma.application.create({
      data: { name: `License Test App ${SUFFIX}`, slug: `license-test-app-${SUFFIX}`, categoryId, shortDescription: "Test", fullDescription: "Test", status: "PUBLISHED" },
    });
    applicationId = application.id;
  });

  afterAll(async () => {
    if (!categoryId || !applicationId || !customerId) return;
    await prisma.applicationLicense.deleteMany({ where: { customerId } });
    await prisma.application.delete({ where: { id: applicationId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("rejects an unknown license key", async () => {
    const result = await verifyLicense(`${SUFFIX}-NOPE`);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it("verifies an unrestricted ACTIVE license and tracks the check", async () => {
    const license = await prisma.applicationLicense.create({ data: { licenseKey: `${SUFFIX}-OPEN`, customerId, applicationId, status: "ACTIVE" } });

    const result = await verifyLicense(license.licenseKey);
    expect(result.valid).toBe(true);
    expect(result.application?.id).toBe(applicationId);

    const updated = await prisma.applicationLicense.findUniqueOrThrow({ where: { id: license.id } });
    expect(updated.verificationCount).toBe(1);
    expect(updated.lastVerifiedAt).not.toBeNull();

    const result2 = await verifyLicense(license.licenseKey);
    expect(result2.valid).toBe(true);
    const updated2 = await prisma.applicationLicense.findUniqueOrThrow({ where: { id: license.id } });
    expect(updated2.verificationCount).toBe(2);
  });

  it("rejects a suspended license", async () => {
    const license = await prisma.applicationLicense.create({ data: { licenseKey: `${SUFFIX}-SUSPENDED`, customerId, applicationId, status: "SUSPENDED" } });
    const result = await verifyLicense(license.licenseKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/suspended/i);
  });

  it("rejects a revoked license", async () => {
    const license = await prisma.applicationLicense.create({ data: { licenseKey: `${SUFFIX}-REVOKED`, customerId, applicationId, status: "REVOKED" } });
    const result = await verifyLicense(license.licenseKey);
    expect(result.valid).toBe(false);
  });

  it("rejects an expired license", async () => {
    const license = await prisma.applicationLicense.create({
      data: { licenseKey: `${SUFFIX}-EXPIRED`, customerId, applicationId, status: "ACTIVE", expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const result = await verifyLicense(license.licenseKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it("restricts a license to its allowedDomains once set", async () => {
    const license = await prisma.applicationLicense.create({
      data: { licenseKey: `${SUFFIX}-DOMAIN`, customerId, applicationId, status: "ACTIVE", allowedDomains: ["app.example.com"] },
    });

    const wrongDomain = await verifyLicense(license.licenseKey, "other.example.com");
    expect(wrongDomain.valid).toBe(false);
    expect(wrongDomain.reason).toMatch(/not authorized/i);

    const noDomain = await verifyLicense(license.licenseKey);
    expect(noDomain.valid).toBe(false);

    const rightDomain = await verifyLicense(license.licenseKey, "https://app.example.com/some/path");
    expect(rightDomain.valid).toBe(true);
  });

  it("setAllowedDomains normalizes and dedupes domains, and is scoped to the owning customer", async () => {
    const license = await prisma.applicationLicense.create({ data: { licenseKey: `${SUFFIX}-SETDOMAINS`, customerId, applicationId, status: "ACTIVE" } });

    const updated = await setAllowedDomains(license.id, customerId, ["https://App.Example.com/", "www.app.example.com", "app.example.com"]);
    expect(updated.allowedDomains).toEqual(["app.example.com"]);

    await expect(setAllowedDomains(license.id, "someone-else", ["evil.example.com"])).rejects.toThrow(/not found/i);
  });
}, 30000);
