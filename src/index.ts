import { Hono } from "hono";
import type { AppBindings } from "./types";
import { storefront, media } from "./routes/storefront";
import { securityHeaders } from "./middleware/security";
import { t } from "./i18n/hinglish";

const app = new Hono<AppBindings>();

app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ status: "ok", db: row?.ok === 1, env: c.env.APP_ENV, time: new Date().toISOString() });
});

app.get("/", (c) => c.json({ name: "Vedhin Digital", message: "Platform chal raha hai." }));

app.use("*", securityHeaders);
app.route("/", storefront);
app.route("/", media);

app.notFound((c) => c.json({ error: t.shopNotFound }, 404));
app.onError((err, c) => {
  console.error("unhandled", err.message);
  return c.json({ error: t.somethingWrong }, 500);
});

export default app;
