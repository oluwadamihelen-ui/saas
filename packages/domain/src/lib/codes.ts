/**
 * Deterministic entity code generation (spec §13-16: CHAR-MAR-01,
 * LOC-HOSP-01, WARD-MAR-01, PROP-PHONE-MAR-01, …). Codes are generated
 * server-side from the entity name rather than trusted from a model
 * response, so they're always well-formed and collision-free within a
 * project regardless of what the agent returns.
 */
export function slugFragment(name: string, length = 3): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters.slice(0, length) || "XXX").padEnd(length, "X");
}

export function makeEntityCode(prefix: string, name: string, index: number): string {
  return `${prefix}-${slugFragment(name)}-${String(index).padStart(2, "0")}`;
}
