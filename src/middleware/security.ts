import { isDeployed } from "../lib/secret";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

/** CSRF defence for cookie-authenticated POSTs: Origin (or Referer) host must match request host. */
export const sameOrigin: MiddlewareHandler<AppBindings> = async (c, next) => {
  const m = c.req.method;
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return next();
  const origin = c.req.header("origin") ?? c.req.header("referer");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(c.req.url).host) return c.text("This request is not allowed.", 403);
    } catch {
      return c.text("This request is not allowed.", 403);
    }
  } else if (isDeployed(c.env)) {
    return c.text("This request is not allowed.", 403);
  }
  return next();
};

export const securityHeaders: MiddlewareHandler<AppBindings> = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Pages use inline styles/scripts we ship ourselves; no third-party scripts. Fonts come from Google Fonts only.
  c.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'");
  if (isDeployed(c.env)) c.header("Strict-Transport-Security", "max-age=31536000");
};
