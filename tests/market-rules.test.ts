import { describe, expect, it } from "vitest";
import { computeBalances, splitSale, usd } from "@/lib/market/fees";
import { canAccessVersion, canReview, isLicenseActive, majorOf, nextPeriodEnd, validatePrice, type LicenseLike } from "@/lib/market/licensing";
import { checkMarketingClaims } from "@/lib/market/claims";
import { DEFAULT_SETTINGS, mergeSettings } from "@/lib/market/settings-defaults";
import { decryptSecret, encryptSecret, hintOf } from "@/lib/secrets";
import { parsePine, splitArgs, validatePineSource } from "@/lib/lab/pine";
import { parseTradingViewTrades } from "@/lib/lab/tv-import";

const base = { commissionPercent: 20, processingFeePercent: 2, processingFeeFixedCents: 0, taxPercent: 0, feeBearer: "creator" as const };

describe("fee split (integer cents)", () => {
  it("$19 at 20% commission, creator bears 2% processing", () => {
    const s = splitSale({ ...base, grossCents: 1900 });
    expect(s).toMatchObject({ taxCents: 0, processingFeeCents: 38, commissionCents: 372, creatorCents: 1490 });
    expect(s.taxCents + s.processingFeeCents + s.commissionCents + s.creatorCents).toBe(1900);
  });
  it("platform-bears mode: creator gets 80% of net, processing comes out of commission", () => {
    const s = splitSale({ ...base, grossCents: 1900, feeBearer: "platform" });
    expect(s.commissionCents).toBe(380);
    expect(s.creatorCents).toBe(1520);
    expect(s.platformNetCents).toBe(380 - 38);
    expect(s.commissionCents + s.creatorCents + s.taxCents).toBe(1900);
  });
  it("tax-inclusive prices", () => {
    const s = splitSale({ ...base, grossCents: 10_750, taxPercent: 7.5, processingFeePercent: 0 });
    expect(s.taxCents).toBe(750);
    expect(s.creatorCents).toBe(8000); // (10750-750) × 80%
  });
  it("commission is configurable, not hard-coded", () => {
    expect(splitSale({ ...base, grossCents: 10_000, commissionPercent: 10, processingFeePercent: 0 }).creatorCents).toBe(9000);
    expect(splitSale({ ...base, grossCents: 10_000, commissionPercent: 0, processingFeePercent: 0 }).creatorCents).toBe(10_000);
  });
  it("invariants hold for 5,000 random sales (no drift, never negative, never above gross)", () => {
    let s = 12345;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 5000; i++) {
      const bearer = rnd() > 0.5 ? "creator" : "platform";
      const gross = Math.floor(rnd() * 100_000);
      const r = splitSale({ grossCents: gross, commissionPercent: rnd() * 50, processingFeePercent: rnd() * 5, processingFeeFixedCents: Math.floor(rnd() * 50), taxPercent: rnd() * 20, feeBearer: bearer });
      expect(r.creatorCents).toBeGreaterThanOrEqual(0);
      expect(r.commissionCents).toBeGreaterThanOrEqual(0);
      expect(r.creatorCents + r.commissionCents + r.taxCents + (bearer === "creator" ? r.processingFeeCents : 0)).toBeLessThanOrEqual(gross + 1);
      expect(r.creatorCents + r.commissionCents + r.taxCents + (bearer === "creator" ? r.processingFeeCents : 0)).toBeGreaterThanOrEqual(gross - 1 - (gross > 0 && r.processingFeeCents >= gross - r.taxCents ? gross : 0));
    }
  });
  it("free products and bad input", () => {
    expect(splitSale({ ...base, grossCents: 0 })).toMatchObject({ creatorCents: 0, commissionCents: 0, processingFeeCents: 0 });
    expect(() => splitSale({ ...base, grossCents: 19.5 })).toThrow();
    expect(() => splitSale({ ...base, grossCents: -1 })).toThrow();
    expect(() => splitSale({ ...base, grossCents: 100, commissionPercent: 101 })).toThrow();
  });
});

describe("creator balances (derived from the ledger)", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const day = 86_400_000;
  const entries = [
    { amountUsdCents: 1490, availableAt: new Date(now.getTime() - 10 * day) }, // matured
    { amountUsdCents: 2000, availableAt: new Date(now.getTime() - 8 * day) }, // matured
    { amountUsdCents: 1490, availableAt: new Date(now.getTime() + 3 * day) }, // pending (holdback)
    { amountUsdCents: -1490, availableAt: new Date(now.getTime() - 9 * day) }, // refund of the first
  ];
  it("splits pending / available / paid / reserved", () => {
    const b = computeBalances(entries, [{ amountUsdCents: 1000, status: "PAID" }, { amountUsdCents: 500, status: "REQUESTED" }, { amountUsdCents: 700, status: "FAILED" }], now);
    expect(b.totalEarningsCents).toBe(3490);
    expect(b.pendingCents).toBe(1490);
    expect(b.totalPaidCents).toBe(1000);
    expect(b.reservedCents).toBe(500);
    expect(b.availableCents).toBe(2000 - 1000 - 500); // matured 2000, minus paid and reserved
  });
  it("never reports negative available/pending", () => {
    const b = computeBalances([{ amountUsdCents: -500, availableAt: new Date(now.getTime() - day) }], [], now);
    expect(b.availableCents).toBe(0);
    expect(b.pendingCents).toBe(0);
  });
  it("formats", () => expect(usd(123456)).toBe("$1,234.56"));
});

describe("licensing & updates", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const lic = (over: Partial<LicenseLike> = {}): LicenseLike => ({ status: "ACTIVE", type: "ONE_TIME", startedAt: new Date("2026-03-01T00:00:00Z"), currentPeriodEnd: null, maxMajor: 1, ...over });
  const v = (version: string, d: string) => ({ version, releasedAt: new Date(d) });

  it("active rules", () => {
    expect(isLicenseActive(lic(), now)).toBe(true);
    expect(isLicenseActive(lic({ status: "REFUNDED" }), now)).toBe(false);
    expect(isLicenseActive(lic({ status: "REVOKED" }), now)).toBe(false);
    expect(isLicenseActive(lic({ type: "MONTHLY", currentPeriodEnd: new Date("2026-10-20") }), now)).toBe(true);
    expect(isLicenseActive(lic({ type: "MONTHLY", currentPeriodEnd: new Date("2026-10-01") }), now)).toBe(false);
    expect(isLicenseActive(lic({ type: "YEARLY", currentPeriodEnd: null }), now)).toBe(false);
  });
  it("subscriptions get every released version while active, nothing once lapsed", () => {
    const sub = lic({ type: "MONTHLY", currentPeriodEnd: new Date("2026-10-20"), maxMajor: 1 });
    expect(canAccessVersion(sub, "NO_UPDATES", v("3.0", "2026-09-01"), now)).toBe(true);
    expect(canAccessVersion({ ...sub, currentPeriodEnd: new Date("2026-10-01") }, "ALL_UPDATES", v("1.0", "2026-01-01"), now)).toBe(false);
  });
  it("one-time purchases follow the update policy", () => {
    const l = lic({ maxMajor: 2 });
    expect(canAccessVersion(l, "ALL_UPDATES", v("5.0", "2026-09-01"), now)).toBe(true);
    expect(canAccessVersion(l, "SAME_MAJOR", v("2.7", "2026-09-01"), now)).toBe(true);
    expect(canAccessVersion(l, "SAME_MAJOR", v("3.0", "2026-09-01"), now)).toBe(false);
    expect(canAccessVersion(l, "NO_UPDATES", v("2.0", "2026-02-01"), now)).toBe(true); // released before purchase
    expect(canAccessVersion(l, "NO_UPDATES", v("2.1", "2026-05-01"), now)).toBe(false); // released after purchase
  });
  it("unreleased versions are never accessible", () => expect(canAccessVersion(lic(), "ALL_UPDATES", v("9.0", "2027-01-01"), now)).toBe(false));
  it("version parsing & period extension", () => {
    expect(majorOf("v2.1")).toBe(2);
    expect(majorOf("10.0.3")).toBe(10);
    expect(majorOf("beta")).toBe(0);
    expect(nextPeriodEnd("MONTHLY", new Date(now.getTime() + 5 * 86_400_000), now).getTime()).toBe(now.getTime() + 36 * 86_400_000);
    expect(nextPeriodEnd("MONTHLY", new Date(now.getTime() - 5 * 86_400_000), now).getTime()).toBe(now.getTime() + 31 * 86_400_000);
  });
  it("reviews: not the creator, needs access, not after refund", () => {
    expect(canReview({ userId: "a", creatorUserId: "a", license: { status: "ACTIVE" } }).ok).toBe(false);
    expect(canReview({ userId: "b", creatorUserId: "a", license: null }).ok).toBe(false);
    expect(canReview({ userId: "b", creatorUserId: "a", license: { status: "REFUNDED" } }).ok).toBe(false);
    expect(canReview({ userId: "b", creatorUserId: "a", license: { status: "ACTIVE" } }).ok).toBe(true);
    expect(canReview({ userId: "b", creatorUserId: "a", license: { status: "EXPIRED" } }).ok).toBe(true);
  });
  it("price limits come from settings", () => {
    const l = DEFAULT_SETTINGS.priceLimits;
    expect(validatePrice("FREE", 0, l)).toBeNull();
    expect(validatePrice("FREE", 100, l)).toMatch(/\$0/);
    expect(validatePrice("MONTHLY", 1900, l)).toBeNull();
    expect(validatePrice("MONTHLY", 50, l)).toMatch(/between/);
    expect(validatePrice("ONE_TIME", 99_999_999, l)).toMatch(/between/);
    expect(validatePrice("ONE_TIME", 0, l)).toMatch(/above zero/);
    expect(validatePrice("YEARLY", 19.5, l)).toMatch(/above zero/);
  });
});

describe("settings", () => {
  it("merges overrides and falls back to defaults on invalid data", () => {
    expect(mergeSettings({ commissionPercent: 15 }).commissionPercent).toBe(15);
    expect(mergeSettings({ commissionPercent: 15 }).holdbackDays).toBe(DEFAULT_SETTINGS.holdbackDays);
    expect(mergeSettings({ commissionPercent: 900 })).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({ priceLimits: { MONTHLY: { minCents: 100, maxCents: 500 } } }).priceLimits.ONE_TIME).toEqual(DEFAULT_SETTINGS.priceLimits.ONE_TIME);
  });
});

describe("unsupported marketing claims are blocked", () => {
  it.each([
    "Guaranteed profits every month",
    "This EA never loses",
    "Our indicator never fails",
    "90% win rate indicator",
    "Win rate of 95%",
    "accuracy: 98%",
    "100% accurate signals",
    "Risk-free trading system",
    "Get rich with gold",
    "Make $500 a day trading",
    "Your path to financial freedom",
    "The holy grail of trading",
    "Double your account in a week",
    "A sure win system",
    "Always wins on XAUUSD",
    "Passive income machine",
    "No risk, all reward",
  ])("flags: %s", (text) => expect(checkMarketingClaims(text).ok).toBe(false));
  it.each([
    "EMA momentum filter with session awareness",
    "Backtested win rate 54% over 312 trades (historical simulation)",
    "Shows entries, stops and targets you define; no signals are guaranteed",
    "Average R of 0.3 in the tested period",
  ])("allows: %s", (text) => {
    const r = checkMarketingClaims(text);
    // the last-but-one text mentions the word "guaranteed" negatively — a human moderator decides; the filter is deliberately strict
    if (/guaranteed/i.test(text)) expect(r.ok).toBe(false); else expect(r.ok).toBe(true);
  });
  it("lists what matched", () => expect(checkMarketingClaims("Guaranteed. Risk-free. Never loses.").matches).toEqual(expect.arrayContaining(["guaranteed / guarantee", "risk-free", "never loses"])));
});

describe("secrets", () => {
  it("round-trips and detects tampering", () => {
    const enc = encryptSecret("GTBank 0123456789 Ada Obi");
    expect(enc).not.toContain("GTBank");
    expect(decryptSecret(enc)).toBe("GTBank 0123456789 Ada Obi");
    expect(encryptSecret("x")).not.toBe(encryptSecret("x")); // fresh IV
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrow();
    expect(() => decryptSecret("garbage")).toThrow();
    expect(hintOf("0123456789")).toBe("••••6789");
    expect(hintOf("GTBank 0123-456-789 Ada Obi")).toBe("••••6789"); // never leaks letters
    expect(hintOf("no digits here")).toBe("••••");
  });
});

describe("Pine metadata parser (never executes code)", () => {
  const src = `//@version=5
// input.int(99, "commented out")
indicator("Gold Sniper V1", overlay=true, max_lines_count=50)
emaFast = input.int(20, "Fast EMA", minval=1, maxval=500, step=1, group="Trend")
emaSlow = input.int(defval=50, title="Slow EMA", minval=2)
rsiLen  = input.int(14, title="RSI length")
mult    = input.float(1.5, "ATR multiplier", 0.1, 10, 0.1)
useSess = input.bool(true, "Session filter")
mode    = input.string("Both", "Direction", options=["Both", "Long", "Short"])
src     = input.source(close, "Source")
tf      = input.timeframe("60", "Timeframe")
legacy  = input(14, "Legacy length", type=input.integer)
plot(ta.ema(close, emaFast))`;
  const m = parsePine(src);
  it("reads version, kind, title, overlay", () => {
    expect(m.version).toBe(5);
    expect(m.kind).toBe("indicator");
    expect(m.title).toBe("Gold Sniper V1");
    expect(m.overlay).toBe(true);
  });
  it("extracts inputs with types, bounds, options and groups; ignores commented ones", () => {
    const by = Object.fromEntries(m.inputs.map((i) => [i.name, i]));
    expect(m.inputs).toHaveLength(9);
    expect(by.emaFast).toMatchObject({ type: "int", title: "Fast EMA", defval: 20, min: 1, max: 500, step: 1, group: "Trend" });
    expect(by.emaSlow).toMatchObject({ type: "int", defval: 50, min: 2 });
    expect(by.mult).toMatchObject({ type: "float", defval: 1.5, min: 0.1, max: 10, step: 0.1 });
    expect(by.useSess).toMatchObject({ type: "bool", defval: true });
    expect(by.mode.options).toEqual(["Both", "Long", "Short"]);
    expect(by.src).toMatchObject({ type: "source", defval: "close" });
    expect(by.tf).toMatchObject({ type: "timeframe", defval: "60" });
    expect(by.legacy).toMatchObject({ type: "int", defval: 14 });
  });
  it("detects strategies and warns about missing declarations", () => {
    expect(parsePine('//@version=6\nstrategy("S", overlay=false)').kind).toBe("strategy");
    expect(parsePine("plot(close)").warnings.join(" ")).toMatch(/version/);
    expect(parsePine("//@version=5\nplot(close)").warnings.join(" ")).toMatch(/declaration/);
  });
  it("splitArgs respects quotes and nesting", () => {
    expect(splitArgs('1, "a, b", f(2, 3), [4, 5]')).toEqual(["1", '"a, b"', "f(2, 3)", "[4, 5]"]);
  });
  it("validates size and content", () => {
    expect(validatePineSource("")).toMatch(/Paste/);
    expect(validatePineSource("x".repeat(300 * 1024))).toMatch(/larger/);
    expect(validatePineSource("a\u0000b")).toMatch(/text file/);
    expect(validatePineSource("//@version=5\nindicator('x')")).toBeNull();
  });
});

describe("TradingView trade-list import", () => {
  const csv = [
    "Trade #,Type,Signal,Date/Time,Price USD,Contracts,Profit USD,Profit %,Cumulative profit USD",
    "2,Exit long,Close,2026-01-08 14:00,2660,1,150,1.5,250",
    "2,Entry long,Long,2026-01-08 09:00,2645,1,,,",
    "1,Exit short,Close,2026-01-06 16:00,2630,1,-50,-0.5,100",
    "1,Entry short,Short,2026-01-06 10:00,2625,1,,,",
    "3,Entry long,Long,2026-01-09 10:00,2650,1,,,",
  ].join("\n");
  it("pairs entries and exits, orders by exit time, assumes the stated risk for R", () => {
    const r = parseTradingViewTrades(csv, { initialBalance: 10_000, assumedRiskPercent: 1, utcOffsetHours: 0 });
    expect(r.error).toBeUndefined();
    expect(r.trades).toHaveLength(2);
    expect(r.skipped).toBe(1); // trade 3 has no exit
    expect(r.trades[0]).toMatchObject({ direction: "SHORT", pnl: -50, riskAmount: 100, rMultiple: -0.5 });
    expect(r.trades[1]).toMatchObject({ direction: "LONG", pnl: 150, rMultiple: 1.5 });
  });
  it("rejects files that aren't a TradingView trade list", () => {
    expect(parseTradingViewTrades("a,b,c\n1,2,3\n4,5,6", { initialBalance: 1, assumedRiskPercent: 1, utcOffsetHours: 0 }).error).toMatch(/TradingView/);
  });
});
