import { timingSafeEqual } from "crypto";

/** Cron endpoints require `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically). */
export function cronAuthorized(req: Request): { ok: boolean; status: number } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 503 };
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? { ok: true, status: 200 } : { ok: false, status: 401 };
}
