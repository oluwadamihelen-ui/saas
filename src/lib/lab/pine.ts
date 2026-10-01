/**
 * Pine Script METADATA parser. It reads text only — Pine source is never executed,
 * evaluated or sent anywhere. Extracts the version, declaration kind/title and
 * `input.*()` definitions so the creator can review/edit them.
 */
export const MAX_PINE_BYTES = 200 * 1024;

export type PineInputType = "int" | "float" | "bool" | "string" | "source" | "timeframe" | "color" | "unknown";

export interface PineInput {
  name: string;
  type: PineInputType;
  title: string;
  defval: string | number | boolean | null;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group?: string;
}

export interface PineMeta {
  version: number | null;
  kind: "indicator" | "strategy" | "library" | "unknown";
  title: string | null;
  overlay: boolean | null;
  inputs: PineInput[];
  warnings: string[];
}

/** Splits a call's argument text on top-level commas (respecting quotes, (), [] and {}). */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quote: string | null = null, cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === "\\") { cur += s[++i] ?? ""; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Finds the text inside the balanced parentheses that start at `open` (index of "("). */
function balanced(src: string, open: number): string | null {
  let depth = 0, quote: string | null = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(") depth++;
    if (c === ")") { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return null;
}

function literal(raw: string | undefined): string | number | boolean | null {
  if (raw === undefined) return null;
  const t = raw.trim();
  if (/^(true|false)$/.test(t)) return t === "true";
  if (/^[-+]?\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = t.match(/^(["'])([\s\S]*)\1$/);
  if (m) return m[2];
  return t || null; // identifiers like `close` for input.source
}

function str(raw: string | undefined): string | undefined {
  const v = literal(raw);
  return typeof v === "string" ? v : undefined;
}
function numOf(raw: string | undefined): number | undefined {
  const v = literal(raw);
  return typeof v === "number" ? v : undefined;
}

function splitNamed(args: string[]) {
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const a of args) {
    const m = a.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]*)$/);
    if (m) named[m[1]] = m[2].trim(); else positional.push(a);
  }
  return { positional, named };
}

const TYPE_MAP: Record<string, PineInputType> = {
  int: "int", integer: "int", float: "float", bool: "bool", string: "string", source: "source", timeframe: "timeframe", color: "color",
};

export function parsePine(source: string): PineMeta {
  const warnings: string[] = [];
  const meta: PineMeta = { version: null, kind: "unknown", title: null, overlay: null, inputs: [], warnings };

  const v = source.match(/^\s*\/\/\s*@version\s*=\s*(\d+)/m);
  if (v) meta.version = Number(v[1]);
  else warnings.push("No //@version=… line found.");

  // Remove // comments (outside strings, good enough for metadata) so commented-out inputs are ignored.
  const clean = source.split("\n").map((ln) => {
    let q: string | null = null;
    for (let i = 0; i < ln.length; i++) {
      const c = ln[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === "/" && ln[i + 1] === "/") return ln.slice(0, i);
    }
    return ln;
  }).join("\n");

  const decl = clean.match(/(?:^|\n)\s*(indicator|strategy|library)\s*\(/);
  if (decl) {
    meta.kind = decl[1] as PineMeta["kind"];
    const args = balanced(clean, (decl.index ?? 0) + decl[0].length - 1);
    if (args !== null) {
      const { positional, named } = splitNamed(splitArgs(args));
      meta.title = str(named.title ?? positional[0]) ?? null;
      if (named.overlay !== undefined) meta.overlay = literal(named.overlay) === true;
    }
  } else {
    const legacy = clean.match(/(?:^|\n)\s*study\s*\(/);
    if (legacy) { meta.kind = "indicator"; warnings.push("Uses legacy study(); consider upgrading to Pine v5/v6."); }
    else warnings.push("No indicator(), strategy() or library() declaration found.");
  }

  const re = /(?:^|\n)[ \t]*(?:var\s+)?(?:(?:int|float|bool|string|color)\s+)?([A-Za-z_]\w*)\s*=\s*input(?:\.(\w+))?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const name = m[1];
    const args = balanced(clean, m.index + m[0].length - 1);
    if (args === null) { warnings.push(`Could not read the arguments of input "${name}".`); continue; }
    const { positional, named } = splitNamed(splitArgs(args));
    let type: PineInputType = m[2] ? TYPE_MAP[m[2]] ?? "unknown" : "unknown";
    const legacyType = named.type?.match(/input\.(\w+)/)?.[1];
    if (type === "unknown" && legacyType) type = TYPE_MAP[legacyType] ?? "unknown";

    const defRaw = named.defval ?? positional[0];
    let defval = literal(defRaw);
    if (type === "unknown") type = typeof defval === "number" ? (Number.isInteger(defval) ? "int" : "float") : typeof defval === "boolean" ? "bool" : typeof defval === "string" ? "string" : "unknown";
    if (type === "source" && typeof defval === "string") defval = defval.replace(/^["']|["']$/g, "");

    const numeric = type === "int" || type === "float";
    const input: PineInput = {
      name,
      type,
      title: str(named.title ?? positional[1]) ?? name,
      defval,
    };
    if (numeric) {
      const mn = numOf(named.minval ?? positional[2]);
      const mx = numOf(named.maxval ?? positional[3]);
      const st = numOf(named.step ?? positional[4]);
      if (mn !== undefined) input.min = mn;
      if (mx !== undefined) input.max = mx;
      if (st !== undefined) input.step = st;
    }
    if (named.options) {
      const opts = named.options.replace(/^\[|\]$/g, "");
      input.options = splitArgs(opts).map((o) => String(literal(o)));
    }
    const group = str(named.group);
    if (group) input.group = group;
    meta.inputs.push(input);
    if (meta.inputs.length >= 200) { warnings.push("More than 200 inputs found; the rest were ignored."); break; }
  }
  return meta;
}

/** Cheap structural checks before storing a source (not a compiler). */
export function validatePineSource(source: string): string | null {
  if (!source.trim()) return "Paste or upload your Pine Script.";
  if (Buffer.byteLength(source, "utf8") > MAX_PINE_BYTES) return `Script is larger than ${MAX_PINE_BYTES / 1024} KB.`;
  if (source.includes("\u0000")) return "That doesn't look like a text file.";
  return null;
}
