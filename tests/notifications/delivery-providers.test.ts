import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import {
  saveNotificationProviderCredential,
  removeNotificationProviderCredential,
  setActiveEmailProvider,
  setActiveSmsProvider,
} from "@/lib/services/notification-delivery";
import { resolveActiveEmailProvider, resolveActiveSmsProvider } from "@/lib/notification-delivery/registry";
import { notifyParentFeesOutstanding } from "@/lib/services/notifications";
import { setNotificationChannelPreference } from "@/lib/services/notifications";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);
afterEach(() => {
  vi.restoreAllMocks();
});

let counter = 0;
async function makeSchool(namePrefix: string) {
  counter += 1;
  const slug = `vitest-notifdelivery-${namePrefix}-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_OWNER", name: "Owner" } });
  const guardianUser = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `guardian-${slug}@vitest.local`, passwordHash: "x", name: "Guardian", status: "ACTIVE" },
  });
  return { school, guardianUser };
}

describe("Notification provider credentials — save/list/remove", () => {
  it("encrypts the API key at rest and round-trips it through decryptSecret", async () => {
    const { school } = await makeSchool("save");
    await saveNotificationProviderCredential(school.id, {
      provider: "RESEND",
      fromIdentifier: "notifications@school.example",
      apiKey: "re_test_key_12345",
      isEnabled: true,
    });

    const row = await prisma.notificationProviderCredential.findUniqueOrThrow({
      where: { schoolId_provider: { schoolId: school.id, provider: "RESEND" } },
    });
    expect(row.apiKeyEnc).not.toContain("re_test_key_12345");
    expect(decryptSecret(row.apiKeyEnc)).toBe("re_test_key_12345");
  });

  it("requires an Account SID for Twilio", async () => {
    const { school } = await makeSchool("twilio-sid");
    await expect(
      saveNotificationProviderCredential(school.id, {
        provider: "TWILIO",
        fromIdentifier: "+15551234567",
        apiKey: "auth_token_123",
        isEnabled: true,
      })
    ).rejects.toThrow(/Account SID/);
  });

  it("saves Twilio with an Account SID and keeps the existing one on a later edit that omits it", async () => {
    const { school } = await makeSchool("twilio-edit");
    await saveNotificationProviderCredential(school.id, {
      provider: "TWILIO",
      fromIdentifier: "+15551234567",
      apiKey: "auth_token_123",
      accountSid: "AC1234567890",
      isEnabled: true,
    });
    await saveNotificationProviderCredential(school.id, {
      provider: "TWILIO",
      fromIdentifier: "+15559999999",
      isEnabled: false,
    });

    const row = await prisma.notificationProviderCredential.findUniqueOrThrow({
      where: { schoolId_provider: { schoolId: school.id, provider: "TWILIO" } },
    });
    expect(row.fromIdentifier).toBe("+15559999999");
    expect(row.isEnabled).toBe(false);
    expect(decryptSecret(row.accountSidEnc!)).toBe("AC1234567890");
    expect(decryptSecret(row.apiKeyEnc)).toBe("auth_token_123");
  });

  it("clears the school's active provider for that channel when its credential is removed", async () => {
    const { school } = await makeSchool("remove");
    await saveNotificationProviderCredential(school.id, { provider: "RESEND", fromIdentifier: "a@b.com", apiKey: "key", isEnabled: true });
    await setActiveEmailProvider(school.id, "RESEND");

    await removeNotificationProviderCredential(school.id, "RESEND");

    const updated = await prisma.school.findUniqueOrThrow({ where: { id: school.id } });
    expect(updated.activeEmailProvider).toBeNull();
    const row = await prisma.notificationProviderCredential.findUnique({ where: { schoolId_provider: { schoolId: school.id, provider: "RESEND" } } });
    expect(row).toBeNull();
  });
});

describe("Active provider selection — channel enforcement", () => {
  it("rejects setting an SMS provider as the active email provider", async () => {
    const { school } = await makeSchool("channel-mismatch");
    await saveNotificationProviderCredential(school.id, {
      provider: "TWILIO",
      fromIdentifier: "+15551234567",
      apiKey: "token",
      accountSid: "AC123",
      isEnabled: true,
    });
    await expect(setActiveEmailProvider(school.id, "TWILIO")).rejects.toThrow(/not a email provider/);
  });

  it("rejects activating a provider that isn't connected yet", async () => {
    const { school } = await makeSchool("not-connected");
    await expect(setActiveEmailProvider(school.id, "RESEND")).rejects.toThrow(/Connect and enable/);
  });

  it("rejects activating a connected-but-disabled provider", async () => {
    const { school } = await makeSchool("disabled");
    await saveNotificationProviderCredential(school.id, { provider: "RESEND", fromIdentifier: "a@b.com", apiKey: "key", isEnabled: false });
    await expect(setActiveEmailProvider(school.id, "RESEND")).rejects.toThrow(/Connect and enable/);
  });
});

describe("registry — resolving a school's active provider", () => {
  it("returns null for both channels when nothing is connected", async () => {
    const { school } = await makeSchool("resolve-none");
    expect(await resolveActiveEmailProvider(school.id)).toBeNull();
    expect(await resolveActiveSmsProvider(school.id)).toBeNull();
  });

  it("resolves the connected, active, enabled provider with decrypted credentials", async () => {
    const { school } = await makeSchool("resolve-some");
    await saveNotificationProviderCredential(school.id, {
      provider: "SENTDM",
      fromIdentifier: "+2348012345678",
      apiKey: "sentdm_key",
      isEnabled: true,
    });
    await setActiveSmsProvider(school.id, "SENTDM");

    const resolved = await resolveActiveSmsProvider(school.id);
    expect(resolved).not.toBeNull();
    expect(resolved!.provider.name).toBe("SENTDM");
    expect(resolved!.credentials.apiKey).toBe("sentdm_key");
    expect(resolved!.credentials.fromIdentifier).toBe("+2348012345678");
  });
});

describe("notifyRecipients — dispatches email/SMS to opted-in recipients through the active provider", () => {
  it("sends an email via the configured provider when the recipient opted in, and skips a recipient who didn't", async () => {
    const { school, guardianUser } = await makeSchool("dispatch-email");
    const otherGuardian = await prisma.user.create({
      data: { schoolId: school.id, roleId: guardianUser.roleId, email: `other-${school.id}@vitest.local`, passwordHash: "x", name: "Other Guardian", status: "ACTIVE" },
    });
    await saveNotificationProviderCredential(school.id, { provider: "RESEND", fromIdentifier: "school@example.com", apiKey: "resend_key", isEnabled: true });
    await setActiveEmailProvider(school.id, "RESEND");
    await setNotificationChannelPreference(school.id, guardianUser.id, "FEES", "email", true);
    // otherGuardian never opts in — should get no email despite being sent the same notification.

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));

    const student = await prisma.student.create({
      data: { schoolId: school.id, firstName: "A", lastName: "B", admissionNumber: `ADM-${school.id}`, status: "ACTIVE" },
    });
    await notifyParentFeesOutstanding(school.id, guardianUser.id, student.id, "A B", 500000, "NGN");
    await notifyParentFeesOutstanding(school.id, otherGuardian.id, student.id, "A B", 500000, "NGN");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("api.resend.com");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toEqual([guardianUser.email]);

    // Both still get the in-app notification regardless of email opt-in.
    const inAppRows = await prisma.notification.findMany({ where: { schoolId: school.id, type: "FEES_OUTSTANDING" } });
    expect(inAppRows).toHaveLength(2);
  });

  it("never sends and never throws when no provider is connected, even if the recipient opted in", async () => {
    const { school, guardianUser } = await makeSchool("dispatch-none");
    await setNotificationChannelPreference(school.id, guardianUser.id, "FEES", "email", true);
    const fetchSpy = vi.spyOn(global, "fetch");

    const student = await prisma.student.create({
      data: { schoolId: school.id, firstName: "C", lastName: "D", admissionNumber: `ADM2-${school.id}`, status: "ACTIVE" },
    });
    await expect(notifyParentFeesOutstanding(school.id, guardianUser.id, student.id, "C D", 100000, "NGN")).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
    const inAppRows = await prisma.notification.findMany({ where: { schoolId: school.id, type: "FEES_OUTSTANDING" } });
    expect(inAppRows).toHaveLength(1);
  });

  it("does not let an email provider failure block the in-app notification it mirrors", async () => {
    const { school, guardianUser } = await makeSchool("dispatch-fail");
    await saveNotificationProviderCredential(school.id, { provider: "RESEND", fromIdentifier: "school@example.com", apiKey: "bad_key", isEnabled: true });
    await setActiveEmailProvider(school.id, "RESEND");
    await setNotificationChannelPreference(school.id, guardianUser.id, "FEES", "email", true);
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

    const student = await prisma.student.create({
      data: { schoolId: school.id, firstName: "E", lastName: "F", admissionNumber: `ADM3-${school.id}`, status: "ACTIVE" },
    });
    await expect(notifyParentFeesOutstanding(school.id, guardianUser.id, student.id, "E F", 200000, "NGN")).resolves.toBeUndefined();

    const inAppRows = await prisma.notification.findMany({ where: { schoolId: school.id, type: "FEES_OUTSTANDING" } });
    expect(inAppRows).toHaveLength(1);
  });
});
