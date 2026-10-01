/**
 * Marketing-claim screen for listings. Blocks the claims the marketplace rules forbid:
 * guaranteed results, "never loses", unrealistic win rates, get-rich language.
 * It is a first filter, not a substitute for human moderation.
 */
const RULES: { re: RegExp; label: string }[] = [
  { re: /\bguarantee(?:d|s)?\b/i, label: "guaranteed / guarantee" },
  { re: /\b(?:never|doesn'?t|does not|won'?t|will not|can'?t|cannot)\s+(?:lose|loses|losing|fail|fails|miss|misses)\b/i, label: "never loses" },
  { re: /\balways\s+(?:wins?|profit(?:able|s)?|works?)\b/i, label: "always wins" },
  { re: /\b(?:100|9\d|8[5-9])\s?%\s*(?:win(?:ning)?(?:\s*rate)?|wins|accura(?:te|cy)|success|profit(?:able)?)/i, label: "unrealistic win-rate / accuracy claim" },
  { re: /\b(?:win(?:ning)?[\s-]?rate|accuracy|success[\s-]?rate)\s*(?:of|is|at|:|=)?\s*(?:100|9\d|8[5-9])(?:\.\d+)?\s?%/i, label: "unrealistic win-rate / accuracy claim" },
  { re: /\b(?:risk|loss)[\s-]?free\b/i, label: "risk-free" },
  { re: /\bno[\s-]?risk\b/i, label: "no risk" },
  { re: /\bget\s+rich\b/i, label: "get rich" },
  { re: /\bfinancial\s+freedom\b/i, label: "financial freedom" },
  { re: /\bpassive\s+income\b/i, label: "passive income" },
  { re: /\bholy\s+grail\b/i, label: "holy grail" },
  { re: /\bdouble\s+your\s+(?:account|money|capital|balance)\b/i, label: "double your account" },
  { re: /\bsure[\s-]?(?:win|fire|profit|thing)\b/i, label: "sure win" },
  { re: /\b(?:make|earn)\s+\$?\d[\d,]*\s*(?:k|usd|dollars)?\s*(?:a|per|every|each)\s*(?:day|week|hour)\b/i, label: "income-per-day claim" },
  { re: /\b(?:predicts?|forecasts?)\s+(?:the\s+)?(?:market|price|future)\s+(?:with\s+)?(?:\d+\s*%|accurately|perfectly|exactly)/i, label: "accurate market prediction" },
  { re: /\b(?:profit|profits|money)\s+(?:is|are)\s+(?:certain|assured|guaranteed)\b/i, label: "assured profit" },
];

export function checkMarketingClaims(...texts: (string | null | undefined)[]): { ok: boolean; matches: string[] } {
  const text = texts.filter(Boolean).join("\n");
  const matches = [...new Set(RULES.filter((r) => r.re.test(text)).map((r) => r.label))];
  return { ok: matches.length === 0, matches };
}
