import type { Env } from "../types";
import { timingSafeEqual } from "./auth";

/** Verify Meta's X-Hub-Signature-256 over the raw body. */
export async function verifySignature(secret: string, rawBody: string, header: string | undefined): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(header.slice(7), hex);
}

export interface Incoming {
  id: string;
  from: string;
  type: "text" | "image" | "audio" | "other";
  text: string;
  mediaId?: string;
}

/** Extract user messages from a WhatsApp Cloud API webhook payload (ignores status updates). */
export function parseIncoming(payload: unknown): Incoming[] {
  const out: Incoming[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const e of entries) {
    for (const ch of (e as { changes?: unknown[] })?.changes ?? []) {
      const msgs = ((ch as { value?: { messages?: unknown[] } })?.value?.messages ?? []) as Record<string, any>[];
      for (const m of msgs) {
        if (typeof m?.id !== "string" || typeof m?.from !== "string") continue;
        if (m.type === "text") out.push({ id: m.id, from: m.from, type: "text", text: String(m.text?.body ?? "").slice(0, 1000) });
        else if (m.type === "image") out.push({ id: m.id, from: m.from, type: "image", text: String(m.image?.caption ?? "").slice(0, 300), mediaId: String(m.image?.id ?? "") });
        else if (m.type === "audio") out.push({ id: m.id, from: m.from, type: "audio", text: "" });
        else if (m.type === "interactive") out.push({ id: m.id, from: m.from, type: "text", text: String(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "").slice(0, 200) });
        else out.push({ id: m.id, from: m.from, type: "other", text: "" });
      }
    }
  }
  return out;
}

/** Download a WhatsApp media item. Returns null when not configured or on failure. */
export async function fetchMedia(env: Env, mediaId: string): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  if (!env.WHATSAPP_TOKEN || !mediaId) return null;
  try {
    const meta = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, { headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}` } });
    if (!meta.ok) return null;
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    if (!/^image\/(jpeg|png|webp)$/.test(mime_type) || !/^https:\/\/[a-z0-9.-]*(facebook|fbcdn|whatsapp)\./i.test(url)) return null;
    const r = await fetch(url, { headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}` } });
    if (!r.ok) return null;
    const bytes = await r.arrayBuffer();
    if (bytes.byteLength > 5 * 1024 * 1024) return null;
    return { bytes, mime: mime_type };
  } catch {
    return null;
  }
}
