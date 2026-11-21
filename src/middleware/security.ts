import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

/** CSRF defence for cookie-authenticated POSTs: Origin (or Referer) host must match request host. */
export const sameOrigin: MiddlewareHandler<AppBindings> = async (c, next) => {
  const m = c.req.method;
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return next();
  const origin = c.req.header("origin") ?? c.req.header("referer");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(c.req.url).host) return c.text("Request allowed nahi hai.", 403);
    } catch {
      return c.text("Request allowed nahi hai.", 403);
    }
  } else if (c.env.APP_ENV === "production") {
    return c.text("Request allowed nahi hai.", 403);
  }
  return next();
};

export const securityHeaders: MiddlewareHandler<AppBindings> = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "SAMEORIGIN");
};
