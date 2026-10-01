import { describe, expect, it } from "vitest";
import { dedupeHeaders, mapHeaders, mapRows, normalizeSymbol, parseCsv, parseDateTime, parseDirection, parseNumber, type ImportOptions } from "@/lib/engine/csv-import";

const opts: ImportOptions = { utcOffsetHours: 1, dayFirst: true, accountCurrency: "USD", fxRate: 1, includeCosts: true };

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded newlines and BOM", () => {
    const t = parseCsv('﻿a,b\n"x, y","he said ""hi"""\n"line1\nline2",z\n');
    expect(t).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["line1\nline2", "z"]]);
  });
  it("detects semicolon and tab delimiters, skips blank lines, CRLF", () => {
    expect(parseCsv("a;b\r\n1;2\r\n\r\n3;4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("values", () => {
  it("numbers: US, EU, negatives, parentheses, currency", () => {
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("(45.10)")).toBe(-45.1);
    expect(parseNumber("$-3")).toBe(-3);
    expect(parseNumber("1 234.5")).toBe(1234.5);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
  it("dates: MT5, ISO, day-first, offset applied", () => {
    expect(parseDateTime("2026.09.01 10:15:30", 1)?.toISOString()).toBe("2026-09-01T09:15:30.000Z");
    expect(parseDateTime("2026-09-01T10:15", 0)?.toISOString()).toBe("2026-09-01T10:15:00.000Z");
    expect(parseDateTime("01/09/2026 10:15", 0, true)?.toISOString()).toBe("2026-09-01T10:15:00.000Z");
    expect(parseDateTime("01/09/2026 10:15", 0, false)?.toISOString()).toBe("2026-01-09T10:15:00.000Z");
    expect(parseDateTime("2026-09-01 2:30 PM", 0)?.toISOString()).toBe("2026-09-01T14:30:00.000Z");
    expect(parseDateTime("not a date", 0)).toBeNull();
    expect(parseDateTime("2026-13-01", 0)).toBeNull();
    expect(parseDateTime("2026-02-31 10:00", 1)).toBeNull();
  });
  it("directions & symbols", () => {
    expect(parseDirection("Buy")).toBe("LONG");
    expect(parseDirection("SELL")).toBe("SHORT");
    expect(parseDirection("balance")).toBeNull();
    expect(normalizeSymbol("XAUUSDm")).toBe("XAUUSD");
    expect(normalizeSymbol("eurusd.a")).toBe("EURUSD");
    expect(normalizeSymbol("US30#")).toBe("US30");
  });
});

describe("headers", () => {
  it("dedupes MT5's repeated Time/Price columns", () => {
    expect(dedupeHeaders(["Time", "Price", "Time", "Price"])).toEqual(["time", "price", "time 2", "price 2"]);
  });
  it("maps MT5 position report headers", () => {
    const { map } = mapHeaders(["Time", "Position", "Symbol", "Type", "Volume", "Price", "S / L", "T / P", "Time", "Price", "Commission", "Swap", "Profit"]);
    expect(map.openedAt).toBe(0);
    expect(map.externalId).toBe(1);
    expect(map.instrument).toBe(2);
    expect(map.direction).toBe(3);
    expect(map.lots).toBe(4);
    expect(map.entryPrice).toBe(5);
    expect(map.stopLoss).toBe(6);
    expect(map.takeProfit).toBe(7);
    expect(map.exitPrice).toBe(9);
    expect(map.pnl).toBe(12);
  });
});

describe("mapRows", () => {
  const mt5 = [
    ["Time", "Position", "Symbol", "Type", "Volume", "Price", "S / L", "T / P", "Time", "Price", "Commission", "Swap", "Profit"],
    ["2026.09.01 10:15:30", "1001", "XAUUSDm", "buy", "0.01", "2650.00", "2640.00", "2680.00", "2026.09.01 12:00:00", "2680.00", "-0.07", "0", "30.00"],
    ["2026.09.02 09:00:00", "1002", "EURUSD", "sell", "0.50", "1.1000", "1.1020", "0", "2026.09.02 11:00:00", "1.1020", "0", "0", "-100.00"],
    ["2026.09.03 09:00:00", "1003", "XAUUSD", "buy", "0.01", "2650", "0", "0", "2026.09.03 10:00:00", "2651", "0", "0", "1.00"],
    ["2026.09.04 09:00:00", "1004", "", "balance", "", "", "", "", "", "", "", "", "1000"],
    ["garbage", "1005", "XAUUSD", "buy", "0.01", "2650", "2640", "", "", "", "", "", "5"],
  ];
  const res = mapRows(mt5, opts);

  it("imports valid rows with estimated risk from presets", () => {
    const t = res.rows[0].trade!;
    expect(t.instrument).toBe("XAUUSD");
    expect(t.direction).toBe("LONG");
    expect(t.riskAmount).toBeCloseTo(10); // 0.01 lot × $1000/lot
    expect(t.riskEstimated).toBe(true);
    expect(t.pnl).toBeCloseTo(29.93); // profit + commission
    expect(t.rMultiple).toBeCloseTo(2.993);
    expect(t.externalId).toBe("t:1001");
    expect(t.openedAt.toISOString()).toBe("2026-09-01T09:15:30.000Z");
    const t2 = res.rows[1].trade!;
    expect(t2.direction).toBe("SHORT");
    expect(t2.takeProfit).toBeNull();
    expect(t2.riskAmount).toBeCloseTo(100); // 20 pips × 0.5 lot × $10
  });
  it("skips rows with a reason instead of guessing", () => {
    expect(res.rows[2].error).toMatch(/No stop loss/);
    expect(res.rows[3].error).toMatch(/buy\/sell/);
    expect(res.rows[4].error).toMatch(/Unreadable date/);
  });
  it("uses the file's risk amount when present and makes stable hash ids without tickets", () => {
    const own = mapRows([
      ["date", "instrument", "direction", "entry", "stop_loss", "lots", "risk_amount", "pnl"],
      ["2026-09-01 10:00", "BTCUSD", "LONG", "60000", "59500", "0.04", "20", "40"],
    ], opts);
    const t = own.rows[0].trade!;
    expect(t.riskAmount).toBe(20);
    expect(t.riskEstimated).toBe(false);
    expect(t.rMultiple).toBe(2);
    expect(t.externalId).toMatch(/^h:[0-9a-f]{20}$/);
    expect(mapRows([["date", "instrument", "direction", "entry", "stop_loss", "lots", "risk_amount", "pnl"], ["2026-09-01 10:00", "BTCUSD", "LONG", "60000", "59500", "0.04", "20", "40"]], opts).rows[0].trade!.externalId).toBe(t.externalId);
  });
  it("rejects wrong-side stops, unknown instruments without risk, missing columns, empty and oversized files", () => {
    expect(mapRows([["date", "instrument", "direction", "entry", "stop_loss", "lots"], ["2026-09-01 10:00", "XAUUSD", "buy", "2650", "2660", "0.01"]], opts).rows[0].error).toMatch(/wrong side/);
    expect(mapRows([["date", "instrument", "direction", "entry", "stop_loss", "lots"], ["2026-09-01 10:00", "FOOBAR", "buy", "10", "9", "1"]], opts).rows[0].error).toMatch(/no preset/);
    expect(mapRows([["foo", "bar"], ["1", "2"]], opts).fatal).toMatch(/Couldn't find/);
    expect(mapRows([["date"]], opts).fatal).toMatch(/no data rows/);
    const big = [["date", "instrument", "direction", "entry", "stop_loss", "lots"], ...Array.from({ length: 2001 }, () => ["2026-09-01 10:00", "XAUUSD", "buy", "2650", "2640", "0.01"])];
    expect(mapRows(big, opts).fatal).toMatch(/Too many rows/);
  });
  it("round-trips RiskPilot's own export format", () => {
    const csv = 'date,account,instrument,direction,entry,stop_loss,take_profit,exit,lots,risk_percent,risk_amount,result,pnl,r_multiple,setup,session,emotion_before,emotion_after,tags,notes\n"2026-09-01T09:15:00.000Z","Exness","XAUUSD","LONG","2650","2640","2680","2680","0.01","1.000","10","WIN","30","3.000","Breakout","London","Calm","Calm","london;news","ok"';
    const r = mapRows(parseCsv(csv), { ...opts, utcOffsetHours: 0 });
    expect(r.rows[0].error).toBeUndefined();
    const t = r.rows[0].trade!;
    expect(t.tags).toEqual(["london", "news"]);
    expect(t.setup).toBe("Breakout");
    expect(t.pnl).toBe(30);
  });
});
