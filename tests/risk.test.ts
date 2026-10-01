import { describe, expect, it } from "vitest";
import {
  RiskInputError,
  calculateDrawdown,
  calculateExpectancy,
  calculateLossPerLot,
  calculatePositionSize,
  calculatePotentialLoss,
  calculatePotentialProfit,
  calculateProfitFactor,
  calculateRiskAmount,
  calculateRiskPercentage,
  calculateRiskReward,
  calculateStopDistance,
  classifyRisk,
  computePositionSize,
  computeRisk,
  type InstrumentSpec,
} from "@/lib/engine/risk";
import { presetFor } from "@/lib/engine/instruments";

const XAU = presetFor("XAUUSD") as InstrumentSpec;
const EUR = presetFor("EURUSD") as InstrumentSpec;
const BTC = presetFor("BTCUSD") as InstrumentSpec;

describe("basic calculations", () => {
  it("risk amount / percentage", () => {
    expect(calculateRiskAmount(1000, 1)).toBe(10);
    expect(calculateRiskPercentage(10, 1000)).toBe(1);
  });
  it("stop distance is absolute", () => {
    expect(calculateStopDistance(2650, 2640)).toBe(10);
    expect(calculateStopDistance(2640, 2650)).toBe(10);
  });
  it("risk reward", () => {
    expect(calculateRiskReward(2650, 2640, 2680)).toBeCloseTo(3);
  });
});

describe("spec example: $1,000, 1%, XAUUSD 2650 → 2640", () => {
  const r = computePositionSize({ balance: 1000, riskPercent: 1, entry: 2650, stopLoss: 2640, takeProfit: 2680, spec: XAU });
  it("sizes to 0.01 lot", () => {
    if (!r.ok) throw new Error("expected ok");
    expect(r.riskAmount).toBe(10);
    expect(r.stopDistance).toBe(10);
    expect(r.lossPerLot).toBeCloseTo(1000);
    expect(r.size.lots).toBe(0.01);
    expect(r.direction).toBe("LONG");
    expect(r.potentialLoss).toBeCloseTo(10);
    expect(r.potentialProfit).toBeCloseTo(30);
    expect(r.riskReward).toBeCloseTo(3);
    expect(r.specStatus).toBe("estimated");
    expect(r.level).toBe("LOW");
  });
  it("marks confirmed specs", () => {
    const c = computePositionSize({ balance: 1000, riskPercent: 1, entry: 2650, stopLoss: 2640, spec: XAU, specConfirmed: true });
    expect(c.ok && c.specStatus).toBe("confirmed");
  });
});

describe("other instruments & currencies", () => {
  it("EURUSD 10k, 1%, 20 pip stop = 0.5 lot", () => {
    const r = computePositionSize({ balance: 10000, riskPercent: 1, entry: 1.1, stopLoss: 1.098, spec: EUR });
    if (!r.ok) throw new Error("expected ok");
    expect(r.size.lots).toBe(0.5);
  });
  it("BTCUSD", () => {
    const r = computePositionSize({ balance: 1000, riskPercent: 2, entry: 60000, stopLoss: 59500, spec: BTC });
    if (!r.ok) throw new Error("expected ok");
    // $500/lot, $20 risk → 0.04
    expect(r.size.lots).toBe(0.04);
  });
  it("short trade direction inferred, NGN conversion applied", () => {
    const r = computePositionSize({ balance: 1_500_000, riskPercent: 1, entry: 2640, stopLoss: 2650, spec: XAU, fxRate: 1500 });
    if (!r.ok) throw new Error("expected ok");
    expect(r.direction).toBe("SHORT");
    expect(r.riskAmount).toBe(15000);
    // loss/lot = 1000 USD * 1500 = 1.5M NGN → 0.01 lot
    expect(r.size.lots).toBe(0.01);
  });
  it("rounds DOWN so risk never exceeds budget", () => {
    const r = computePositionSize({ balance: 1000, riskPercent: 1, entry: 100, stopLoss: 99, spec: { ...EUR, tickSize: 0.01, tickValue: 0.35 } });
    if (!r.ok) throw new Error("expected ok");
    expect(r.actualRisk).toBeLessThanOrEqual(r.riskAmount + 1e-9);
  });
});

describe("edge cases", () => {
  const base = { balance: 1000, riskPercent: 1, entry: 2650, stopLoss: 2640, spec: XAU };
  const err = (x: Parameters<typeof computePositionSize>[0]) => {
    const r = computePositionSize(x);
    if (r.ok) throw new Error("expected failure");
    return r.errors[0];
  };

  it("zero balance", () => expect(err({ ...base, balance: 0 }).field).toBe("balance"));
  it("negative balance", () => expect(err({ ...base, balance: -5 }).field).toBe("balance"));
  it("negative prices", () => {
    expect(err({ ...base, entry: -1 }).field).toBe("entry");
    expect(err({ ...base, stopLoss: -1 }).field).toBe("stopLoss");
  });
  it("entry = stop loss", () => expect(err({ ...base, stopLoss: 2650 }).message).toMatch(/cannot equal/));
  it("negative / zero risk percent", () => {
    expect(err({ ...base, riskPercent: -1 }).field).toBe("riskPercent");
    expect(err({ ...base, riskPercent: 0 }).field).toBe("riskPercent");
  });
  it("risk above 100%", () => expect(err({ ...base, riskPercent: 101 }).field).toBe("riskPercent"));
  it("NaN input", () => expect(err({ ...base, entry: NaN }).field).toBe("entry"));
  it("invalid contract size", () => expect(err({ ...base, spec: { ...XAU, contractSize: 0 } }).field).toBe("contractSize"));
  it("invalid tick size", () => expect(err({ ...base, spec: { ...XAU, tickSize: -1 } }).field).toBe("tickSize"));
  it("invalid tick value", () => expect(err({ ...base, spec: { ...XAU, tickValue: 0 } }).field).toBe("tickValue"));
  it("invalid lot step", () => expect(err({ ...base, spec: { ...XAU, lotStep: 0 } }).field).toBe("lotStep"));
  it("max lot below min lot", () => expect(err({ ...base, spec: { ...XAU, minLot: 1, maxLot: 0.5 } }).field).toBe("maxLot"));
  it("invalid fx rate", () => expect(err({ ...base, fxRate: 0 }).field).toBe("fxRate"));

  it("below minimum lot → 0 lots + warning with risk at min lot", () => {
    const r = computePositionSize({ ...base, balance: 100, riskPercent: 1 }); // $1 risk vs $1000/lot
    if (!r.ok) throw new Error("expected ok");
    expect(r.size.status).toBe("below_min_lot");
    expect(r.size.lots).toBe(0);
    expect(r.size.riskAtMinLot).toBeCloseTo(10);
    expect(r.warnings.join(" ")).toMatch(/minimum lot/);
  });
  it("above maximum lot → clamped", () => {
    const r = computePositionSize({ ...base, balance: 10_000_000, riskPercent: 50, spec: { ...XAU, maxLot: 5 } });
    if (!r.ok) throw new Error("expected ok");
    expect(r.size.status).toBe("above_max_lot");
    expect(r.size.lots).toBe(5);
  });
  it("respects non-0.01 lot step (floors to step)", () => {
    const s = calculatePositionSize(37, 100, { minLot: 0.1, maxLot: 100, lotStep: 0.1 }); // raw 0.37
    expect(s.lots).toBe(0.3);
    expect(s.status).toBe("ok");
  });
  it("lot step grid anchored at min lot", () => {
    const s = calculatePositionSize(0.62, 1, { minLot: 0.05, maxLot: 10, lotStep: 0.1 }); // 0.05, 0.15, 0.25...
    expect(s.lots).toBe(0.55);
  });
  it("floating-point safe at exact step", () => {
    const s = calculatePositionSize(0.3, 1, { minLot: 0.01, maxLot: 10, lotStep: 0.01 });
    expect(s.lots).toBe(0.3);
  });
  it("take profit on wrong side warns and gives no R:R", () => {
    const r = computePositionSize({ ...base, takeProfit: 2600 });
    if (!r.ok) throw new Error("expected ok");
    expect(r.riskReward).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/same side/);
  });
  it("warns when above user's max risk per trade", () => {
    const r = computePositionSize({ ...base, riskPercent: 3, maxRiskPerTrade: 1 });
    if (!r.ok) throw new Error("expected ok");
    expect(r.warnings.join(" ")).toMatch(/max risk per trade/);
  });
  it("low-level helpers throw RiskInputError", () => {
    expect(() => calculateRiskAmount(0, 1)).toThrow(RiskInputError);
    expect(() => calculateLossPerLot(XAU, 0)).toThrow(RiskInputError);
    expect(() => calculatePotentialLoss(-1, 10)).toThrow(RiskInputError);
    expect(() => calculatePotentialProfit(1, 100, 100, XAU)).toThrow(RiskInputError);
  });
});

describe("risk calculator (known lot size)", () => {
  it("computes risk for given lots", () => {
    const r = computeRisk({ balance: 1000, entry: 2650, stopLoss: 2640, takeProfit: 2670, lots: 0.05, spec: XAU });
    if (!r.ok) throw new Error("expected ok");
    expect(r.riskAmount).toBeCloseTo(50);
    expect(r.riskPercent).toBeCloseTo(5);
    expect(r.level).toBe("HIGH");
    expect(r.potentialProfit).toBeCloseTo(100);
    expect(r.riskReward).toBeCloseTo(2);
  });
  it("flags EXTREME and over-balance risk", () => {
    const r = computeRisk({ balance: 100, entry: 2650, stopLoss: 2640, lots: 0.5, spec: XAU });
    if (!r.ok) throw new Error("expected ok");
    expect(r.level).toBe("EXTREME");
    expect(r.warnings.join(" ")).toMatch(/whole account/);
  });
  it("warns on lot step mismatch / below min / above max", () => {
    const a = computeRisk({ balance: 1000, entry: 100, stopLoss: 99, lots: 0.015, spec: { ...XAU, tickSize: 0.01, tickValue: 1 } });
    expect(a.ok && a.warnings.join(" ")).toMatch(/lot step/);
    const b = computeRisk({ balance: 1000, entry: 100, stopLoss: 99, lots: 0.001, spec: XAU });
    expect(b.ok && b.warnings.join(" ")).toMatch(/Below the minimum/);
    const c = computeRisk({ balance: 1000, entry: 100, stopLoss: 99, lots: 500, spec: XAU });
    expect(c.ok && c.warnings.join(" ")).toMatch(/Above the maximum/);
  });
  it("rejects zero lots", () => expect(computeRisk({ balance: 1000, entry: 1, stopLoss: 0.9, lots: 0, spec: EUR }).ok).toBe(false));
});

describe("risk bands (configurable)", () => {
  it("default thresholds", () => {
    expect(classifyRisk(0.5)).toBe("LOW");
    expect(classifyRisk(1)).toBe("LOW");
    expect(classifyRisk(1.5)).toBe("MODERATE");
    expect(classifyRisk(3)).toBe("HIGH");
    expect(classifyRisk(5.01)).toBe("EXTREME");
  });
  it("custom thresholds", () => {
    expect(classifyRisk(1.5, { lowMax: 2, moderateMax: 3, highMax: 4 })).toBe("LOW");
  });
});

describe("performance maths", () => {
  it("drawdown", () => {
    const d = calculateDrawdown([1000, 1100, 990, 1200, 1080]);
    expect(d.maxDrawdownAmount).toBeCloseTo(120);
    expect(d.maxDrawdownPercent).toBeCloseTo(10);
    expect(d.currentDrawdownPercent).toBeCloseTo(10);
    expect(d.series).toHaveLength(5);
  });
  it("drawdown of empty / rising series is zero", () => {
    expect(calculateDrawdown([]).maxDrawdownPercent).toBe(0);
    expect(calculateDrawdown([1, 2, 3]).maxDrawdownPercent).toBe(0);
  });
  it("expectancy", () => {
    expect(calculateExpectancy([2, -1, 1, -1])).toBeCloseTo(0.25);
    expect(calculateExpectancy([])).toBeNull();
  });
  it("profit factor", () => {
    expect(calculateProfitFactor([100, -50, 50, -50])).toBeCloseTo(1.5);
    expect(calculateProfitFactor([10, 20])).toBe(Infinity);
    expect(calculateProfitFactor([])).toBeNull();
    expect(calculateProfitFactor([-10])).toBe(0);
  });
});
