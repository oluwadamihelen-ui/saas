import { describe, it, expect, vi, afterEach } from "vitest";
import { ResendEmailProvider } from "@/lib/providers/email/resend";

describe("ResendEmailProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a correctly-shaped request to the Resend API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "resend_msg_123" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ResendEmailProvider("test-api-key", "Test <test@example.com>");
    const result = await provider.send({ to: "customer@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" });

    expect(result.providerMessageId).toBe("resend_msg_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-api-key");

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ from: "Test <test@example.com>", to: ["customer@example.com"], subject: "Hello", html: "<p>Hi</p>", text: "Hi" });
  });

  it("testConnection reports AUTH_FAILED on a 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Invalid API key" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ResendEmailProvider("bad-key");
    const result = await provider.testConnection();
    expect(result.state).toBe("AUTH_FAILED");
  });

  it("testConnection reports CONNECTED when the API responds successfully", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ResendEmailProvider("good-key");
    const result = await provider.testConnection();
    expect(result.state).toBe("CONNECTED");
  });
});
