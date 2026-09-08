import "server-only";

/// A gateway's error responses aren't always JSON (network issues, a
/// proxy/edge error page, an outage) — parsing that as JSON throws a raw
/// SyntaxError that would otherwise surface verbatim to the payer. This
/// normalizes any non-JSON body into a clean, generic failure instead.
export async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/// Wraps a gateway call so a DNS/connection failure surfaces as one
/// clean, expected error rather than a raw fetch/undici exception
/// reaching the payer.
export async function gatewayFetch(input: string, init: RequestInit, gatewayName: string): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(`Could not reach ${gatewayName} right now. Please try again shortly.`);
  }
}
