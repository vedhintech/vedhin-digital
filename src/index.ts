import { Hono } from "hono";
import type { AppBindings } from "./types";
import { storefront, media } from "./routes/storefront";
import { seller } from "./routes/seller";
import { admin } from "./routes/admin";
import { runScheduled } from "./cron";
import type { Env } from "./types";
import { webhooks } from "./routes/webhooks";
import { publicPages } from "./routes/public";
import { securityHeaders } from "./middleware/security";
import { t } from "./i18n/hinglish";
import { telegram } from "./lib/notify";
import { dbRateLimit } from "./lib/rate";

const app = new Hono<AppBindings>();

app.use("*", securityHeaders);

app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ status: "ok", db: row?.ok === 1, env: c.env.APP_ENV, time: new Date().toISOString() });
});

app.get("/", (c) => c.json({ name: "Vedhin Digital", message: "Platform is running." }));

app.route("/", storefront);
app.route("/", media);
app.route("/", seller);
app.route("/", admin);
app.route("/", webhooks);
app.route("/", publicPages);

app.notFound((c) => c.json({ error: t.shopNotFound }, 404));
app.onError((err, c) => {
  console.error("unhandled", err.message);
  // Tell the founder on Telegram, at most once per 10 minutes, with no personal data.
  const alert = (async () => {
    try {
      if (!(await dbRateLimit(c.env.DB, "err-alert", 1, 600_000))) return;
      await telegram(c.env, `Error on ${new URL(c.req.url).pathname.replace(/[0-9a-f]{8,}/gi, ":id")} (${c.req.method}): ${String(err.message).slice(0, 120)}`);
    } catch { /* never let alerting break the response */ }
  })();
  try { c.executionCtx.waitUntil(alert); } catch { /* no execution context in tests */ }
  return c.json({ error: t.somethingWrong }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env));
  },
};
export { app };
