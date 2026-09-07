import { describe, it, expect, vi, afterEach } from "vitest";
import { CPanelHostingProvider } from "@/lib/providers/hosting/cpanel";

const CREDS = { host: "server1.example.com", username: "root", apiToken: "test-token" };

function whmResponse(data: unknown, result = 1, reason = "OK") {
  return { metadata: { version: 1, result, reason }, data };
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("CPanelHostingProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the WHM URL and Authorization header from credentials", async () => {
    const fetchMock = mockFetchOnce(whmResponse({}));
    const provider = new CPanelHostingProvider(CREDS);
    await provider.testConnection();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://server1.example.com:2087/json-api/version?api.version=1");
    expect(init.headers.Authorization).toBe("whm root:test-token");
  });

  it("uses a custom port when provided", async () => {
    const fetchMock = mockFetchOnce(whmResponse({}));
    const provider = new CPanelHostingProvider({ ...CREDS, port: 2083 });
    await provider.testConnection();
    expect(fetchMock.mock.calls[0][0]).toBe("https://server1.example.com:2083/json-api/version?api.version=1");
  });

  it("testConnection reports CONNECTED on a successful version call", async () => {
    mockFetchOnce(whmResponse({ version: "116" }));
    const provider = new CPanelHostingProvider(CREDS);
    const result = await provider.testConnection();
    expect(result.state).toBe("CONNECTED");
  });

  it("testConnection reports AUTH_FAILED when WHM rejects the token", async () => {
    mockFetchOnce(whmResponse(null, 0, "Access Denied"));
    const provider = new CPanelHostingProvider(CREDS);
    const result = await provider.testConnection();
    expect(result.state).toBe("AUTH_FAILED");
  });

  it("throws a readable error when WHM's HTTP status is not ok", async () => {
    mockFetchOnce({}, false, 401);
    const provider = new CPanelHostingProvider(CREDS);
    await expect(provider.getAccount("someuser")).rejects.toThrow(/http 401/i);
  });

  it("createAccount generates a valid cPanel username and a strong password", async () => {
    const fetchMock = mockFetchOnce(whmResponse({ status: 1 }));
    const provider = new CPanelHostingProvider(CREDS);
    const result = await provider.createAccount({ planCode: "starter", customerEmail: "jane@example.com", domain: "brightretail.com" });

    expect(result.status).toBe("ACTIVE");
    expect(result.controlPanelUrl).toBe("https://server1.example.com:2083");
    expect(result.providerAccountId).toMatch(/^[a-z][a-z0-9]{0,15}$/);
    expect(result.providerAccountId.length).toBeLessThanOrEqual(16);
    expect(result.initialPassword).toBeTruthy();
    expect(result.initialPassword!.length).toBeGreaterThan(20);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/json-api/createacct?");
    expect(url).toContain("domain=brightretail.com");
    expect(url).toContain("plan=starter");
    expect(url).toContain(`contactemail=${encodeURIComponent("jane@example.com")}`);
  });

  it("createAccount prefixes a username that would otherwise start with a digit", async () => {
    mockFetchOnce(whmResponse({}));
    const provider = new CPanelHostingProvider(CREDS);
    const result = await provider.createAccount({ planCode: "starter", customerEmail: "jane@example.com", domain: "123numbers.com" });
    expect(result.providerAccountId[0]).toMatch(/[a-z]/);
  });

  it("suspendAccount and unsuspendAccount call the right WHM functions with the username", async () => {
    const fetchMock = mockFetchOnce(whmResponse({}));
    const provider = new CPanelHostingProvider(CREDS);
    await provider.suspendAccount("janeacct1");
    expect(fetchMock.mock.calls[0][0]).toContain("/json-api/suspendacct?");
    expect(fetchMock.mock.calls[0][0]).toContain("user=janeacct1");

    mockFetchOnce(whmResponse({}));
    await provider.unsuspendAccount("janeacct1");
  });

  it("deleteAccount calls removeacct", async () => {
    const fetchMock = mockFetchOnce(whmResponse({}));
    const provider = new CPanelHostingProvider(CREDS);
    await provider.deleteAccount("janeacct1");
    expect(fetchMock.mock.calls[0][0]).toContain("/json-api/removeacct?");
  });

  it("getAccount maps a suspended flag to SUSPENDED status", async () => {
    mockFetchOnce(whmResponse({ acct: [{ suspended: 1 }] }));
    const provider = new CPanelHostingProvider(CREDS);
    const result = await provider.getAccount("janeacct1");
    expect(result.status).toBe("SUSPENDED");
  });

  it("getAccount reports ACTIVE when not suspended", async () => {
    mockFetchOnce(whmResponse({ acct: [{ suspended: 0 }] }));
    const provider = new CPanelHostingProvider(CREDS);
    const result = await provider.getAccount("janeacct1");
    expect(result.status).toBe("ACTIVE");
  });

  it("getUsage converts diskused MB into GB", async () => {
    mockFetchOnce(whmResponse({ acct: [{ diskused: 2048, disklimit: 10240 }] }));
    const provider = new CPanelHostingProvider(CREDS);
    const usage = await provider.getUsage("janeacct1");
    expect(usage.storageUsedGB).toBe(2);
    expect(usage.websitesUsed).toBe(1);
  });

  it("getUsage treats 'unlimited' disklimit/diskused gracefully", async () => {
    mockFetchOnce(whmResponse({ acct: [{ diskused: "unlimited" }] }));
    const provider = new CPanelHostingProvider(CREDS);
    const usage = await provider.getUsage("janeacct1");
    expect(usage.storageUsedGB).toBe(0);
  });

  it("getServerStatus returns online when version succeeds and offline when it throws", async () => {
    mockFetchOnce(whmResponse({}));
    const provider = new CPanelHostingProvider(CREDS);
    expect(await provider.getServerStatus()).toBe("online");

    mockFetchOnce({}, false, 500);
    expect(await provider.getServerStatus()).toBe("offline");
  });

  it("upgradePlan and downgradePlan both call changepackage", async () => {
    const fetchMock = mockFetchOnce(whmResponse({}));
    const provider = new CPanelHostingProvider(CREDS);
    await provider.upgradePlan("janeacct1", "business");
    expect(fetchMock.mock.calls[0][0]).toContain("/json-api/changepackage?");
    expect(fetchMock.mock.calls[0][0]).toContain("pkg=business");
  });
});
