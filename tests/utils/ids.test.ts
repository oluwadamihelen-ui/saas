import { describe, expect, it } from "vitest";
import { generateInvoiceNumber, generateLicenseKey, generateOrderNumber, generateTicketNumber } from "@/lib/utils/ids";

describe("id generators", () => {
  it("generates order numbers with the expected prefix and shape", () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber).toMatch(/^ORD-\d{4}-\d{6}$/);
  });

  it("generates invoice numbers scoped to the current year", () => {
    const invoiceNumber = generateInvoiceNumber();
    expect(invoiceNumber).toMatch(new RegExp(`^INV-${new Date().getFullYear()}-\\d{6}$`));
  });

  it("generates ticket numbers", () => {
    expect(generateTicketNumber()).toMatch(/^TCK-\d{7}$/);
  });

  it("generates unique, well-formed license keys", () => {
    const a = generateLicenseKey();
    const b = generateLicenseKey();
    expect(a).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(a).not.toEqual(b);
  });
});
