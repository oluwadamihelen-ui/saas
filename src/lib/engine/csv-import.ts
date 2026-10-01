/**
 * CSV import: parsing and mapping only (pure, no I/O).
 * Understands RiskPilot's own export and MT5-style "Positions" reports, plus
 * generic files whose headers look like date / symbol / side / entry / SL / TP / lots / profit.
 */
import { createHash } from "crypto";
import { INSTRUMENT_PRESETS, presetFor } from "./instruments";
import { computeRisk, calculateRMultiple } from "./risk";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

// ------------------------------------------------------------------ CSV parsing

export function detectDelimiter(headerLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, headerLine.split(d).length - 1] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts.sort((a, b) => b[1] - a[1])[0][0] : ",";
}

/** RFC 4180-style parser: quoted fields, escaped quotes, newlines inside quotes, BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

// ------------------------------------------------------------------ header mapping

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9/&]+/g, " ").replace(/\s*\/\s*/g, "/").trim();

const ALIASES: Record<string, string[]> = {
  openedAt: ["date", "open time", "opentime", "time", "opened", "open date", "date time", "datetime", "entry time"],
  instrument: ["instrument", "symbol", "pair", "market", "asset"],
  direction: ["direction", "type", "side", "action"],
  entryPrice: ["entry", "entry price", "open price", "openprice", "price"],
  stopLoss: ["stop loss", "stop_loss", "sl", "s/l", "stop", "stoploss"],
  takeProfit: ["take profit", "take_profit", "tp", "t/p", "target", "takeprofit"],
  exitPrice: ["exit", "exit price", "close price", "closeprice", "price 2"],
  lots: ["lots", "lot", "volume", "size", "position size", "quantity", "qty"],
  riskAmount: ["risk amount", "risk_amount", "risk"],
  pnl: ["pnl", "p&l", "profit", "net profit", "result pnl", "profit/loss", "profit loss", "net pnl"],
  commission: ["commission", "fee", "fees"],
  swap: ["swap"],
  externalId: ["ticket", "position", "position id", "order", "deal", "id", "trade id"],
  setup: ["setup", "strategy"],
  session: ["session"],
  notes: ["notes", "comment", "note"],
  tags: ["tags", "tag"],
  emotionBefore: ["emotion before", "emotion_before"],
  emotionAfter: ["emotion after", "emotion_after"],
};

export type FieldKey = keyof typeof ALIASES;

/** Duplicate headers (MT5 has two "Time" and two "Price") become "time", "time 2". */
export function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const n = norm(h);
    const c = (seen.get(n) ?? 0) + 1;
    seen.set(n, c);
    return c === 1 ? n : `${n} ${c}`;
  });
}

export function mapHeaders(headers: string[]): { map: Partial<Record<FieldKey, number>>; unmapped: string[] } {
  const hs = dedupeHeaders(headers);
  const map: Partial<Record<FieldKey, number>> = {};
  const used = new Set<number>();
  // Exact alias match, first alias wins by priority order of the ALIASES list.
  for (const key of Object.keys(ALIASES) as FieldKey[]) {
    for (const alias of ALIASES[key]) {
      const idx = hs.findIndex((h, i) => h === alias && !used.has(i));
      if (idx >= 0) { map[key] = idx; used.add(idx); break; }
    }
  }
  return { map, unmapped: headers.filter((_, i) => !used.has(i) && hs[i] !== "") };
}

// ------------------------------------------------------------------ value parsing

export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.trim().replace(/\s/g, "").replace(/[$€£₦]/g, "");
  if (s === "" || s === "-") return null;
  const neg = /^\(.*\)$/.test(s);
  if (neg) s = s.slice(1, -1);
  // 1.234,56 (EU) vs 1,234.56 (US)
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/**
 * Parses ISO ("2026-09-01 10:15"), MT5 ("2026.09.01 10:15:30") and day-first
 * ("01/09/2026 10:15") timestamps. The wall-clock time is interpreted at
 * `utcOffsetHours` (e.g. 1 for Lagos) and returned as a real instant.
 */
export function parseDateTime(raw: string | undefined, utcOffsetHours: number, dayFirst = true): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  let y: number, mo: number, d: number, rest: string;
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[T\s]+(.*))?$/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4] ?? ""; }
  else {
    m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?:[T\s]+(.*))?$/);
    if (!m) return null;
    const a = +m[1], b = +m[2];
    if (dayFirst) { d = a; mo = b; } else { mo = a; d = b; }
    y = +m[3]; rest = m[4] ?? "";
  }
  let hh = 0, mm = 0, ss = 0;
  if (rest) {
    const t = rest.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(AM|PM|Z)?$/i);
    if (!t) return null;
    if (t[4]?.toUpperCase() === "Z") utcOffsetHours = 0; // explicit UTC timestamp
    hh = +t[1]; mm = +t[2]; ss = t[3] ? +t[3] : 0;
    const suf = t[4]?.toUpperCase();
    if (suf === "PM" && hh < 12) hh += 12;
    if (suf === "AM" && hh === 12) hh = 0;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  if (new Date(Date.UTC(y, mo - 1, d)).getUTCDate() !== d) return null; // e.g. 31 Feb
  return new Date(Date.UTC(y, mo - 1, d, hh, mm, ss) - utcOffsetHours * 3_600_000);
}

export function parseDirection(raw: string | undefined): "LONG" | "SHORT" | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (["buy", "long", "b", "l", "buy limit", "buy stop"].includes(s)) return "LONG";
  if (["sell", "short", "s", "sell limit", "sell stop"].includes(s)) return "SHORT";
  return null;
}

/** "XAUUSDm", "EURUSD.a", "xauusd#" → known preset symbol; otherwise cleaned uppercase. */
export function normalizeSymbol(raw: string): string {
  const up = raw.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  for (const p of INSTRUMENT_PRESETS) if (up.startsWith(p.symbol) && up.length - p.symbol.length <= 3) return p.symbol;
  return up.replace(/[._-].*$/, "") || up;
}

// ------------------------------------------------------------------ row mapping

export interface ImportOptions {
  /** Offset (hours) of the clock used in the file, relative to UTC. */
  utcOffsetHours: number;
  dayFirst: boolean;
  accountCurrency: string;
  /** quote→account conversion used when risk has to be estimated from a preset. */
  fxRate: number;
  /** Add commission + swap columns into P&L when present. */
  includeCosts: boolean;
}

export interface ParsedTrade {
  externalId: string;
  openedAt: Date;
  instrument: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number | null;
  exitPrice: number | null;
  lots: number;
  riskAmount: number;
  riskEstimated: boolean;
  pnl: number | null;
  rMultiple: number | null;
  setup: string | null;
  session: string | null;
  notes: string | null;
  tags: string[];
  emotionBefore: string | null;
  emotionAfter: string | null;
}

export interface ImportRow {
  line: number;
  trade?: ParsedTrade;
  error?: string;
}

export interface ImportParse {
  rows: ImportRow[];
  mapped: FieldKey[];
  unmapped: string[];
  fatal?: string;
}

const REQUIRED: FieldKey[] = ["openedAt", "instrument", "entryPrice", "lots"];

export function mapRows(table: string[][], opts: ImportOptions): ImportParse {
  if (table.length < 2) return { rows: [], mapped: [], unmapped: [], fatal: "The file has no data rows." };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { rows: [], mapped: [], unmapped: [], fatal: `Too many rows (max ${MAX_IMPORT_ROWS} per file). Split the file and import in parts.` };
  const { map, unmapped } = mapHeaders(table[0]);
  const missing = REQUIRED.filter((k) => map[k] === undefined);
  if (map.direction === undefined) missing.push("direction");
  const mapped = Object.keys(map) as FieldKey[];
  if (missing.length) return { rows: [], mapped, unmapped, fatal: `Couldn't find these columns: ${missing.join(", ")}. Check the header row.` };

  const get = (r: string[], k: FieldKey) => (map[k] === undefined ? undefined : r[map[k] as number]);
  const rows: ImportRow[] = [];

  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const fail = (error: string) => rows.push({ line, error });
    const openedAt = parseDateTime(get(r, "openedAt"), opts.utcOffsetHours, opts.dayFirst);
    if (!openedAt) return fail(`Unreadable date "${get(r, "openedAt") ?? ""}"`);
    const rawType = get(r, "direction");
    const direction = parseDirection(rawType);
    if (!direction) return fail(`Not a buy/sell trade (type "${rawType ?? ""}") — skipped`); // balance/deposit rows etc.
    const instrument = normalizeSymbol(get(r, "instrument") ?? "");
    if (!/^[A-Z0-9._-]{2,20}$/.test(instrument)) return fail("Missing or invalid symbol");
    const entry = parseNumber(get(r, "entryPrice"));
    const lots = parseNumber(get(r, "lots"));
    if (entry === null || entry <= 0) return fail("Missing entry price");
    if (lots === null || lots <= 0) return fail("Missing position size");
    const stop = parseNumber(get(r, "stopLoss"));
    const given = parseNumber(get(r, "riskAmount"));
    if ((stop === null || stop <= 0) ) return fail("No stop loss recorded — can't work out how much was risked");
    if (direction === "LONG" ? stop >= entry : stop <= entry) return fail("Stop loss is on the wrong side of entry");
    const tpRaw = parseNumber(get(r, "takeProfit"));
    const tp = tpRaw !== null && tpRaw > 0 ? tpRaw : null;

    let riskAmount = given !== null && given > 0 ? given : null;
    let estimated = false;
    if (riskAmount === null) {
      const spec = presetFor(instrument);
      if (!spec) return fail(`No risk amount in the file and no preset for ${instrument}`);
      const fx = spec.quoteCurrency === opts.accountCurrency ? 1 : opts.fxRate;
      const est = computeRisk({ balance: 1e12, entry, stopLoss: stop, lots, spec, fxRate: fx });
      if (!est.ok) return fail(est.errors[0].message);
      riskAmount = est.riskAmount;
      estimated = true;
    }

    let pnl = parseNumber(get(r, "pnl"));
    if (pnl !== null && opts.includeCosts) pnl += (parseNumber(get(r, "commission")) ?? 0) + (parseNumber(get(r, "swap")) ?? 0);
    const exitRaw = parseNumber(get(r, "exitPrice"));
    const ticket = (get(r, "externalId") ?? "").trim();
    const externalId = ticket
      ? `t:${ticket}`
      : "h:" + createHash("sha1").update([openedAt.toISOString(), instrument, direction, entry, lots].join("|")).digest("hex").slice(0, 20);

    rows.push({
      line,
      trade: {
        externalId, openedAt, instrument, direction, entryPrice: entry, stopLoss: stop, takeProfit: tp,
        exitPrice: exitRaw !== null && exitRaw > 0 ? exitRaw : null,
        lots, riskAmount, riskEstimated: estimated, pnl,
        rMultiple: pnl === null ? null : calculateRMultiple(pnl, riskAmount),
        setup: (get(r, "setup") ?? "").trim().slice(0, 60) || null,
        session: (get(r, "session") ?? "").trim().slice(0, 30) || null,
        notes: (get(r, "notes") ?? "").trim().slice(0, 4000) || null,
        tags: (get(r, "tags") ?? "").split(/[;,]/).map((t) => t.trim().toLowerCase().slice(0, 24)).filter(Boolean).slice(0, 12),
        emotionBefore: (get(r, "emotionBefore") ?? "").trim().slice(0, 30) || null,
        emotionAfter: (get(r, "emotionAfter") ?? "").trim().slice(0, 30) || null,
      },
    });
  });
  return { rows, mapped, unmapped };
}
