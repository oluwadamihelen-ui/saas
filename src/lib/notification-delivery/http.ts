import "server-only";

/// Same reasoning as src/lib/payments/http.ts: a provider's error
/// response isn't always JSON (network issues, a proxy/edge error page,
/// an outage), and a DNS/connection failure should surface as one clean
/// message rather than a raw fetch exception.
export async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function providerFetch(input: string, init: RequestInit, providerName: string): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(`Could not reach ${providerName} right now.`);
  }
}
