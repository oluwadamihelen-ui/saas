// Control characters, zero-width characters and line/paragraph separators.
const UNSAFE = new RegExp(
  "[" + "\\u0000-\\u0008" + "\\u000B\\u000C" + "\\u000E-\\u001F" + "\\u007F" + "\\u200B-\\u200F" + "\\u2028\\u2029" + "\\uFEFF" + "]",
  "g",
);

/** Strip control / invisible characters, trim, and enforce a max length. React escapes output; this keeps stored text clean. */
export function cleanText(input: unknown, max = 2000): string {
  if (typeof input !== "string") return "";
  return input.replace(UNSAFE, "").trim().slice(0, max);
}
