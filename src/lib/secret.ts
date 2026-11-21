import type { Env } from "../types";
/** Session/HMAC secret. Required in production; a fixed dev value is allowed only outside production. */
export function secretOf(env: Env): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.APP_ENV !== "production") return "dev-only-secret";
  throw new Error("SESSION_SECRET is not set");
}
