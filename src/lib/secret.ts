import type { Env } from "../types";

/**
 * True for every deployed environment (production AND Worker Previews).
 * Only "development" (local) and "test" (vitest) may use relaxed dev behaviour; anything else is treated as public-facing.
 */
export const isDeployed = (env: { APP_ENV?: string }) => !!env.APP_ENV && env.APP_ENV !== "development" && env.APP_ENV !== "test";

/** Session/HMAC secret. Required on every deployed environment; a fixed dev value is allowed only for local dev and tests. */
export function secretOf(env: Env): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (!isDeployed(env)) return "dev-only-secret";
  throw new Error("SESSION_SECRET is not set");
}
