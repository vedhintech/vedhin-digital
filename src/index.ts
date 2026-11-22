import { Hono } from "hono";
import type { AppBindings } from "./types";
import { storefront, media } from "./routes/storefront";
import { seller } from "./routes/seller";
import { admin } from "./routes/admin";
import { runScheduled } from "./cron";
import type { Env } from "./types";
import { webhooks } from "./routes/webhooks";
import { securityHeaders } from "./middleware/security";
import { t } from "./i18n/hinglish";

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

app.notFound((c) => c.json({ error: t.shopNotFound }, 404));
app.onError((err, c) => {
  console.error("unhandled", err.message);
  return c.json({ error: t.somethingWrong }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env));
  },
};
export { app };
