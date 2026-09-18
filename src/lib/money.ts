/// All money in this app is stored as an integer in the currency's minor
/// units (e.g. kobo for NGN, 1/100 of a Naira) — never a float — to avoid
/// rounding drift across sums. This is the only place that converts to a
/// display string.
export function formatMoney(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function toMinorUnits(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}
