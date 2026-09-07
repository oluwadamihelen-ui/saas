import { describe, it, expect, vi, afterEach } from "vitest";
import { NamecheapDomainProvider } from "@/lib/providers/domain/namecheap";

const CREDS = { apiUser: "testuser", apiKey: "testkey", username: "testuser", clientIp: "203.0.113.5", sandbox: true };

function xmlResponse(body: string, status = "OK") {
  return `<?xml version="1.0" encoding="utf-8"?><ApiResponse Status="${status}" xmlns="http://api.namecheap.com/xml.response">${body}</ApiResponse>`;
}

function mockFetchOnce(xml: string) {
  const fetchMock = vi.fn().mockResolvedValue({ text: async () => xml });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NamecheapDomainProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the auth triple and Command on every request", async () => {
    const fetchMock = mockFetchOnce(
      xmlResponse(`<CommandResponse><DomainCheckResult Domain="example.com" Available="true" /></CommandResponse>`)
    );
    const provider = new NamecheapDomainProvider(CREDS);
    await provider.checkAvailability("example.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sandbox.namecheap.com/xml.response");
    const body = init.body as URLSearchParams;
    expect(body.get("ApiUser")).toBe("testuser");
    expect(body.get("ApiKey")).toBe("testkey");
    expect(body.get("ClientIp")).toBe("203.0.113.5");
    expect(body.get("Command")).toBe("namecheap.domains.check");
  });

  it("uses the production URL when sandbox is not set", async () => {
    const fetchMock = mockFetchOnce(
      xmlResponse(`<CommandResponse><DomainCheckResult Domain="example.com" Available="true" /></CommandResponse>`)
    );
    const provider = new NamecheapDomainProvider({ ...CREDS, sandbox: false });
    await provider.checkAvailability("example.com");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.namecheap.com/xml.response");
  });

  it("checkAvailability reflects the Available attribute", async () => {
    mockFetchOnce(xmlResponse(`<CommandResponse><DomainCheckResult Domain="taken.com" Available="false" /></CommandResponse>`));
    const provider = new NamecheapDomainProvider(CREDS);
    expect(await provider.checkAvailability("taken.com")).toBe(false);
  });

  it("searchDomain checks every tld and attaches pricing", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const body = init.body as URLSearchParams;
      const command = body.get("Command");
      if (command === "namecheap.domains.check") {
        return {
          text: async () =>
            xmlResponse(
              `<CommandResponse>` +
                `<DomainCheckResult Domain="brand.com" Available="true" />` +
                `<DomainCheckResult Domain="brand.io" Available="false" />` +
                `</CommandResponse>`
            ),
        };
      }
      // namecheap.users.getPricing
      return {
        text: async () =>
          xmlResponse(
            `<CommandResponse><UserGetPricingResult><ProductType Name="DOMAIN"><ProductCategory Name="DOMAINS"><Product Name="com">` +
              `<Price Duration="1" DurationType="YEAR" Price="14.98" YourPrice="13.98" Currency="USD" /></Product>` +
              `</ProductCategory></ProductType></UserGetPricingResult></CommandResponse>`
          ),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NamecheapDomainProvider(CREDS);
    const results = await provider.searchDomain("brand", ["com", "io"]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ domain: "brand.com", tld: "com", available: true, currency: "USD" });
    expect(results[0].registrationPrice).toBeCloseTo(13.98);
    expect(results[1]).toMatchObject({ domain: "brand.io", tld: "io", available: false });
  });

  it("getPricingQuote multiplies the 1-year price when no exact-duration entry exists", async () => {
    mockFetchOnce(
      xmlResponse(
        `<CommandResponse><UserGetPricingResult><ProductType Name="DOMAIN"><ProductCategory Name="DOMAINS"><Product Name="com">` +
          `<Price Duration="1" DurationType="YEAR" YourPrice="10.00" Currency="USD" /></Product>` +
          `</ProductCategory></ProductType></UserGetPricingResult></CommandResponse>`
      )
    );
    const provider = new NamecheapDomainProvider(CREDS);
    const quote = await provider.getPricingQuote("example.com", 3, "register");
    expect(quote).toEqual({ price: 30, currency: "USD" });
  });

  it("getPricingQuote uses the exact-duration entry when Namecheap provides one", async () => {
    mockFetchOnce(
      xmlResponse(
        `<CommandResponse><UserGetPricingResult><ProductType Name="DOMAIN"><ProductCategory Name="DOMAINS"><Product Name="com">` +
          `<Price Duration="1" DurationType="YEAR" YourPrice="10.00" Currency="USD" />` +
          `<Price Duration="2" DurationType="YEAR" YourPrice="18.00" Currency="USD" />` +
          `</Product></ProductCategory></ProductType></UserGetPricingResult></CommandResponse>`
      )
    );
    const provider = new NamecheapDomainProvider(CREDS);
    const quote = await provider.getPricingQuote("example.com", 2, "register");
    expect(quote).toEqual({ price: 18, currency: "USD" });
  });

  it("registerDomain throws when the registrant contact is incomplete", async () => {
    const provider = new NamecheapDomainProvider(CREDS);
    await expect(
      provider.registerDomain({
        domain: "example.com",
        years: 1,
        customerEmail: "jane@example.com",
        customerName: "Jane Doe",
      })
    ).rejects.toThrow(/registrant address/i);
  });

  it("registerDomain sends contact fields for all four contact groups and returns the result", async () => {
    const fetchMock = mockFetchOnce(
      xmlResponse(`<CommandResponse><DomainCreateResult Domain="example.com" Registered="true" DomainID="99" OrderID="1" /></CommandResponse>`)
    );
    const provider = new NamecheapDomainProvider(CREDS);
    const result = await provider.registerDomain({
      domain: "example.com",
      years: 2,
      customerEmail: "jane@example.com",
      customerName: "Jane Doe",
      registrantAddress1: "1 Example Street",
      registrantCity: "Lagos",
      registrantStateProvince: "Lagos",
      registrantPostalCode: "100001",
      registrantCountry: "Nigeria",
      registrantPhone: "+234 801 234 5678",
    });

    expect(result.providerRef).toBe("99");
    expect(result.nameservers).toEqual([]);

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("Command")).toBe("namecheap.domains.create");
    expect(body.get("DomainName")).toBe("example.com");
    expect(body.get("Years")).toBe("2");
    for (const prefix of ["Registrant", "Tech", "Admin", "AuxBilling"]) {
      expect(body.get(`${prefix}FirstName`)).toBe("Jane");
      expect(body.get(`${prefix}Address1`)).toBe("1 Example Street");
      expect(body.get(`${prefix}Phone`)).toBe("+234.8012345678");
    }
  });

  it("registerDomain throws when Namecheap doesn't confirm registration", async () => {
    mockFetchOnce(xmlResponse(`<CommandResponse><DomainCreateResult Domain="example.com" Registered="false" /></CommandResponse>`));
    const provider = new NamecheapDomainProvider(CREDS);
    await expect(
      provider.registerDomain({
        domain: "example.com",
        years: 1,
        customerEmail: "jane@example.com",
        customerName: "Jane Doe",
        registrantAddress1: "1 Example Street",
        registrantCity: "Lagos",
        registrantStateProvince: "Lagos",
        registrantPostalCode: "100001",
        registrantCountry: "Nigeria",
        registrantPhone: "+234.8012345678",
      })
    ).rejects.toThrow(/did not confirm/i);
  });

  it("renewDomain parses the new expiry date", async () => {
    mockFetchOnce(
      xmlResponse(
        `<CommandResponse><DomainRenewResult DomainName="example.com" Renew="true"><DomainDetails><ExpiredDate>01/15/2027</ExpiredDate></DomainDetails></DomainRenewResult></CommandResponse>`
      )
    );
    const provider = new NamecheapDomainProvider(CREDS);
    const { expiresAt } = await provider.renewDomain("example.com", 1);
    expect(new Date(expiresAt).getUTCFullYear()).toBe(2027);
  });

  it("transferDomain maps Transfer=true to PENDING", async () => {
    mockFetchOnce(xmlResponse(`<CommandResponse><DomainTransferCreateResult TransferID="555" Transfer="true" /></CommandResponse>`));
    const provider = new NamecheapDomainProvider(CREDS);
    const result = await provider.transferDomain("example.com", "EPP-CODE");
    expect(result).toEqual({ providerRef: "555", status: "PENDING" });
  });

  it("getDomainDetails maps status and nameservers", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const body = init.body as URLSearchParams;
      if (body.get("Command") === "namecheap.domains.getInfo") {
        return {
          text: async () =>
            xmlResponse(
              `<CommandResponse><DomainGetInfoResult Status="Ok" DomainName="example.com"><DomainDetails><ExpiredDate>01/15/2027</ExpiredDate></DomainDetails></DomainGetInfoResult></CommandResponse>`
            ),
        };
      }
      return {
        text: async () =>
          xmlResponse(
            `<CommandResponse><DomainDNSGetListResult Domain="example.com"><Nameserver>dns1.namecheaphosting.com</Nameserver><Nameserver>dns2.namecheaphosting.com</Nameserver></DomainDNSGetListResult></CommandResponse>`
          ),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NamecheapDomainProvider(CREDS);
    const details = await provider.getDomainDetails("example.com");
    expect(details.status).toBe("ACTIVE");
    expect(details.nameservers).toEqual(["dns1.namecheaphosting.com", "dns2.namecheaphosting.com"]);
  });

  it("createDNSRecord reads the existing set, appends, writes back, and recovers the HostId", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const body = init.body as URLSearchParams;
      const command = body.get("Command");
      if (command === "namecheap.domains.dns.getHosts" && fetchMock.mock.calls.length <= 1) {
        return { text: async () => xmlResponse(`<CommandResponse><DomainDNSGetHostsResult Domain="example.com" /></CommandResponse>`) };
      }
      if (command === "namecheap.domains.dns.setHosts") {
        expect(body.get("HostName1")).toBe("www");
        expect(body.get("RecordType1")).toBe("A");
        expect(body.get("Address1")).toBe("192.0.2.1");
        return { text: async () => xmlResponse(`<CommandResponse><DomainDNSSetHostsResult IsSuccess="true" /></CommandResponse>`) };
      }
      // second getHosts call, after the write
      return {
        text: async () =>
          xmlResponse(
            `<CommandResponse><DomainDNSGetHostsResult Domain="example.com"><host HostId="777" Name="www" Type="A" Address="192.0.2.1" TTL="1800" /></DomainDNSGetHostsResult></CommandResponse>`
          ),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NamecheapDomainProvider(CREDS);
    const { providerRecordId } = await provider.createDNSRecord({ domain: "example.com", type: "A", name: "www", value: "192.0.2.1" });
    expect(providerRecordId).toBe("777");
  });

  it("deleteDNSRecord writes back the set with the target record removed", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const body = init.body as URLSearchParams;
      const command = body.get("Command");
      if (command === "namecheap.domains.dns.getHosts") {
        return {
          text: async () =>
            xmlResponse(
              `<CommandResponse><DomainDNSGetHostsResult Domain="example.com">` +
                `<host HostId="1" Name="@" Type="A" Address="192.0.2.1" TTL="1800" />` +
                `<host HostId="2" Name="www" Type="A" Address="192.0.2.1" TTL="1800" />` +
                `</DomainDNSGetHostsResult></CommandResponse>`
            ),
        };
      }
      expect(body.get("HostName1")).toBe("@");
      expect(body.has("HostName2")).toBe(false);
      return { text: async () => xmlResponse(`<CommandResponse><DomainDNSSetHostsResult IsSuccess="true" /></CommandResponse>`) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NamecheapDomainProvider(CREDS);
    await provider.deleteDNSRecord("example.com", "2");
  });

  it("testConnection reports CONNECTED on a successful call", async () => {
    mockFetchOnce(xmlResponse(`<CommandResponse><DomainCheckResult Domain="x.com" Available="true" /></CommandResponse>`));
    const provider = new NamecheapDomainProvider(CREDS);
    const result = await provider.testConnection();
    expect(result.state).toBe("CONNECTED");
  });

  it("testConnection reports AUTH_FAILED on an invalid-IP error", async () => {
    mockFetchOnce(
      xmlResponse(`<Errors><Error Number="1011150">Invalid request IP: 203.0.113.5</Error></Errors>`, "ERROR")
    );
    const provider = new NamecheapDomainProvider(CREDS);
    const result = await provider.testConnection();
    expect(result.state).toBe("AUTH_FAILED");
  });

  it("throws a readable error when the API responds with Status=ERROR", async () => {
    mockFetchOnce(xmlResponse(`<Errors><Error Number="2011294">Domain name is invalid</Error></Errors>`, "ERROR"));
    const provider = new NamecheapDomainProvider(CREDS);
    await expect(provider.checkAvailability("not a domain")).rejects.toThrow(/domain name is invalid/i);
  });
});
