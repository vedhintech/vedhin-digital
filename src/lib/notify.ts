import type { Env } from "../types";

/** Plain logs never carry full phone numbers or email addresses. */
const maskPhones = (t: string) => t.replace(/\d{6,}/g, (m) => "…" + m.slice(-4));
const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

/** Founder alerts via Telegram. No-op (logged) when not configured. Never throws. */
export async function telegram(env: Env, text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.log("[telegram:stub]", maskPhones(text));
    return false;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Seller email via Resend. No-op when not configured. Never throws. */
export async function email(env: Env, to: string | null | undefined, subject: string, text: string): Promise<boolean> {
  if (!to) return false;
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    console.log("[email:stub]", maskEmail(to), subject);
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** WhatsApp Cloud API text send. Stub when not configured. Returns true if actually sent. */
export async function whatsappText(env: Env, to: string, body: string): Promise<boolean> {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    console.log("[whatsapp:stub] ->", to.slice(-4), body.slice(0, 60));
    return false;
  }
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Business-initiated WhatsApp message must use an approved template. Stub when not configured. */
export async function whatsappTemplate(env: Env, to: string, template: string, params: string[]): Promise<boolean> {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    console.log("[whatsapp:template:stub] ->", to.slice(-4), template);
    return false;
  }
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: template, language: { code: "hi" }, components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] },
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
