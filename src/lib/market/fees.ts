/**
 * Marketplace money maths — INTEGER cents only (no float drift).
 *
 *   tax        = gross × t / (100 + t)            (listed prices are tax-inclusive)
 *   net        = gross − tax
 *   processing = net × p% + fixed                 (estimate of the payment provider's fee)
 *   base       = net − processing   if the creator bears processing fees, else net
 *   commission = base × c%
 *   creator    = base − commission                (never negative)
 *
 * Invariant (creator-bears):  gross = tax + processing + commission + creator
 * Invariant (platform-bears): gross = tax + commission + creator   (processing is paid out of commission)
 */
export interface SplitInput {
  grossCents: number;
  commissionPercent: number;
  processingFeePercent: number;
  processingFeeFixedCents: number;
  taxPercent: number;
  feeBearer: "creator" | "platform";
}
export interface SaleSplit {
  grossCents: number;
  taxCents: number;
  processingFeeCents: number;
  commissionCents: number;
  creatorCents: number;
  /** What the platform keeps after paying provider fees when it bears them. */
  platformNetCents: number;
}

export function splitSale(i: SplitInput): SaleSplit {
  if (!Number.isInteger(i.grossCents) || i.grossCents < 0) throw new Error("Gross must be a non-negative integer (cents)");
  if (i.commissionPercent < 0 || i.commissionPercent > 100) throw new Error("Commission must be 0–100%");
  const tax = i.taxPercent > 0 ? Math.round((i.grossCents * i.taxPercent) / (100 + i.taxPercent)) : 0;
  const net = i.grossCents - tax;
  const processing = i.grossCents === 0 ? 0 : Math.min(net, Math.round((net * i.processingFeePercent) / 100) + i.processingFeeFixedCents);
  const base = i.feeBearer === "creator" ? Math.max(0, net - processing) : net;
  const commission = Math.round((base * i.commissionPercent) / 100);
  const creator = Math.max(0, base - commission);
  return {
    grossCents: i.grossCents,
    taxCents: tax,
    processingFeeCents: processing,
    commissionCents: commission,
    creatorCents: creator,
    platformNetCents: i.feeBearer === "platform" ? commission - processing : commission,
  };
}

// ------------------------------------------------------------------ ledger balances

export interface LedgerRow { amountUsdCents: number; availableAt: Date }
export interface PayoutRow { amountUsdCents: number; status: "REQUESTED" | "PROCESSING" | "PAID" | "FAILED" | "CANCELED" }

export interface Balances {
  /** Everything ever earned, net of refunds. */
  totalEarningsCents: number;
  /** Earned but still inside the refund-protection holdback. */
  pendingCents: number;
  /** Earned, past the holdback and not yet requested/paid out. */
  availableCents: number;
  /** Requested or processing payouts (reserved). */
  reservedCents: number;
  totalPaidCents: number;
}

export function computeBalances(entries: LedgerRow[], payouts: PayoutRow[], now: Date): Balances {
  const total = entries.reduce((a, e) => a + e.amountUsdCents, 0);
  const pending = entries.filter((e) => e.availableAt.getTime() > now.getTime()).reduce((a, e) => a + e.amountUsdCents, 0);
  const matured = total - pending;
  const paid = payouts.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amountUsdCents, 0);
  const reserved = payouts.filter((p) => p.status === "REQUESTED" || p.status === "PROCESSING").reduce((a, p) => a + p.amountUsdCents, 0);
  return {
    totalEarningsCents: total,
    pendingCents: Math.max(0, pending),
    availableCents: Math.max(0, matured - paid - reserved),
    reservedCents: reserved,
    totalPaidCents: paid,
  };
}

export const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
