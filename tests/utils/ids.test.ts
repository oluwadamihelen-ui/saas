import { describe, it, expect } from "vitest";
import {
  generateReservationReference,
  generateInvoiceNumber,
  generatePaymentReference,
  generateExpenseReference,
  slugify,
} from "@/lib/utils/ids";

describe("id generators", () => {
  it("generates a reservation reference matching RES-YYYY-NNNNNN", () => {
    const ref = generateReservationReference();
    expect(ref).toMatch(/^RES-\d{4}-\d{6}$/);
  });

  it("generates an invoice number matching INV-YYYY-NNNNNN", () => {
    const ref = generateInvoiceNumber();
    expect(ref).toMatch(/^INV-\d{4}-\d{6}$/);
  });

  it("generates a payment reference matching PAY-NNNNNNNNN", () => {
    const ref = generatePaymentReference();
    expect(ref).toMatch(/^PAY-\d{9}$/);
  });

  it("generates an expense reference matching EXP-NNNNNNNNN", () => {
    const ref = generateExpenseReference();
    expect(ref).toMatch(/^EXP-\d{9}$/);
  });

  it("generates references that differ across calls", () => {
    const refs = new Set(Array.from({ length: 20 }, () => generateReservationReference()));
    expect(refs.size).toBeGreaterThan(1);
  });

  it("slugifies hotel names", () => {
    expect(slugify("Sunrise Hotel & Suites")).toBe("sunrise-hotel-suites");
    expect(slugify("  Ocean View  ")).toBe("ocean-view");
  });
});
