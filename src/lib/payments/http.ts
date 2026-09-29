/**
 * A gateway's error response isn't always JSON (a WAF, proxy, or an outage
 * page can return HTML/plain text) -- parsing that with `res.json()` throws
 * an unhelpful SyntaxError instead of a message a hotel's staff could act
 * on. This always resolves, folding a bad body into a clear error instead.
 */
export async function safeJson<T>(res: Response): Promise<{ ok: true; body: T } | { ok: false; error: string }> {
  const text = await res.text();
  try {
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    const snippet = text.trim().slice(0, 200) || `HTTP ${res.status}`;
    return { ok: false, error: `Unexpected response from payment provider (status ${res.status}): ${snippet}` };
  }
}
