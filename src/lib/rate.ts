// Best-effort per-isolate rate limiter (sufficient to blunt abuse; not a hard guarantee).
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.n++;
  return b.n <= max;
}
export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}

/** Durable (D1-backed) limiter: counts attempts per key inside a fixed window. Returns false when the limit is exceeded. */
export async function dbRateLimit(db: D1Database, key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  await db.prepare("INSERT INTO rate_limits (key, n, window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET n = CASE WHEN ? - window_start > ? THEN 1 ELSE n + 1 END, window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END")
    .bind(key, now, now, windowMs, now, windowMs, now).run();
  const r = await db.prepare("SELECT n FROM rate_limits WHERE key = ?").bind(key).first<{ n: number }>();
  return (r?.n ?? 0) <= max;
}
