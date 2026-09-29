function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

/** RES-2026-000123 */
export function generateReservationReference(prefix = "RES"): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${randomDigits(6)}`;
}

/** INV-2026-000123 */
export function generateInvoiceNumber(prefix = "INV"): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${randomDigits(6)}`;
}

/** PAY-000000123 */
export function generatePaymentReference(): string {
  return `PAY-${randomDigits(9)}`;
}

/** EXP-000000123 */
export function generateExpenseReference(): string {
  return `EXP-${randomDigits(9)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
