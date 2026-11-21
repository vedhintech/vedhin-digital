import { Hono } from "hono";
import type { AppBindings } from "../types";
import { verifySignature, parseIncoming } from "../lib/wa";
import { handleIncoming } from "../lib/bot";
import { whatsappText, telegram } from "../lib/notify";
import { timingSafeEqual } from "../lib/auth";
import { dailyDigest } from "../cron";

export const webhooks = new Hono<AppBindings>();

// Meta webhook verification handshake.
webhooks.get("/webhooks/whatsapp", (c) => {
  const q = c.req.query();
  if (c.env.WHATSAPP_VERIFY_TOKEN && q["hub.mode"] === "subscribe" && timingSafeEqual(q["hub.verify_token"] ?? "", c.env.WHATSAPP_VERIFY_TOKEN)) return c.text(q["hub.challenge"] ?? "", 200);
  return c.text("forbidden", 403);
});

webhooks.post("/webhooks/whatsapp", async (c) => {
  if (!c.env.WHATSAPP_APP_SECRET) return c.text("webhook not configured", 503);
  const body = await c.req.text();
  if (!(await verifySignature(c.env.WHATSAPP_APP_SECRET, body, c.req.header("x-hub-signature-256")))) return c.text("bad signature", 401);
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return c.text("bad json", 400); }
  const base = new URL(c.req.url).origin;
  for (const m of parseIncoming(payload)) {
    // Idempotency: Meta may redeliver. Claim the message id first; release it if processing fails.
    const claim = (await c.env.DB.prepare("INSERT OR IGNORE INTO processed_webhooks (id, at) VALUES (?,?)").bind(m.id, new Date().toISOString()).run()) as { meta?: { changes?: number } };
    if ((claim.meta?.changes ?? 1) < 1) continue;
    try {
      const replies = await handleIncoming(c.env, m, base);
      for (const r of replies) await whatsappText(c.env, m.from, r);
    } catch (err) {
      console.error("bot error", (err as Error).message);
      await c.env.DB.prepare("DELETE FROM processed_webhooks WHERE id = ?").bind(m.id).run();
      return c.text("retry", 500);
    }
  }
  return c.text("ok", 200);
});

// Founder commands from Telegram (/digest). Only the configured chat is obeyed.
webhooks.post("/webhooks/telegram", async (c) => {
  if (!c.env.TELEGRAM_WEBHOOK_SECRET || !timingSafeEqual(c.req.header("x-telegram-bot-api-secret-token") ?? "", c.env.TELEGRAM_WEBHOOK_SECRET)) return c.text("forbidden", 403);
  const u = (await c.req.json().catch(() => null)) as { message?: { chat?: { id?: number }; text?: string } } | null;
  const chat = String(u?.message?.chat?.id ?? "");
  if (!u?.message || !c.env.TELEGRAM_CHAT_ID || chat !== c.env.TELEGRAM_CHAT_ID) return c.text("ok", 200);
  const cmd = (u.message.text ?? "").trim().split(/\s+/)[0];
  if (cmd === "/digest") await dailyDigest(c.env);
  else await telegram(c.env, "Commands: /digest");
  return c.text("ok", 200);
});
