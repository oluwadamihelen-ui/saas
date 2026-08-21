/**
 * Extracts and parses the first JSON object/array literal found in a
 * language model response. Agents are prompted to respond with JSON only,
 * but models occasionally wrap it in prose or a markdown fence — this
 * makes agent parsing robust to that without silently accepting garbage.
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;

  const trimmed = candidate.trim();
  const start = trimmed.search(/[[{]/);
  if (start === -1) {
    throw new Error("No JSON object or array found in model response.");
  }

  const openChar = trimmed[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let end = -1;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === openChar) depth++;
    else if (trimmed[i] === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error("Unterminated JSON object or array in model response.");
  }

  const jsonSlice = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(jsonSlice) as T;
  } catch (error) {
    throw new Error(`Model response was not valid JSON: ${(error as Error).message}`);
  }
}
