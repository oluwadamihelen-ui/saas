import crypto from "crypto";

function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `ORD-${y}${m}-${randomDigits(6)}`;
}

export function generateInvoiceNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  return `INV-${y}-${randomDigits(6)}`;
}

export function generateTicketNumber(): string {
  return `TCK-${randomDigits(7)}`;
}

export function generateQuoteNumber(): string {
  return `QTE-${randomDigits(6)}`;
}

export function generateLicenseKey(): string {
  const segment = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}
