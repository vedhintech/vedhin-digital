import type { Env } from "../types";
import { newId } from "./id";
import { randomToken, sha256Hex } from "./auth";

/** Creates a single-use login link token (valid 7 days). Founder sends the link on WhatsApp. */
export async function createLoginToken(env: Env, sellerId: string): Promise<string> {
  const token = randomToken(24);
  await env.DB.prepare("INSERT INTO seller_login_tokens (id, seller_id, token_hash, expires_at) VALUES (?,?,?,?)")
    .bind(newId(), sellerId, await sha256Hex(token), new Date(Date.now() + 7 * 86400_000).toISOString())
    .run();
  return token;
}

export async function ensureSeller(env: Env, shopId: string, phone: string, name: string | null, email: string | null): Promise<string> {
  const ex = await env.DB.prepare("SELECT id FROM sellers WHERE phone = ?").bind(phone).first<{ id: string }>();
  if (ex) return ex.id;
  const id = newId();
  await env.DB.prepare("INSERT INTO sellers (id, shop_id, name, phone, email) VALUES (?,?,?,?,?)").bind(id, shopId, name, phone, email).run();
  return id;
}

export const CATEGORY_DEFAULTS: Record<string, string[]> = {
  ladies_dress: ["Suits", "Kurtis", "Sarees", "Lehenga", "Dupatta", "Western"],
  jewellery: ["Necklace Sets", "Earrings", "Bangles", "Maang Tikka", "Rings", "Bridal"],
  other: ["General"],
};

export const ATTR_FIELDS: Record<string, { key: string; label: string; type?: "text" | "bool" }[]> = {
  ladies_dress: [
    { key: "fabric", label: "Fabric (e.g. cotton, georgette)" },
    { key: "work", label: "Work (bandhej, block print, embroidery)" },
    { key: "occasion", label: "Occasion" },
    { key: "sizes", label: "Sizes (S, M, L, XL)" },
    { key: "color", label: "Colour" },
    { key: "care", label: "Care instructions" },
    { key: "ready_stock", label: "Ready stock", type: "bool" },
  ],
  jewellery: [
    { key: "material", label: "Material" },
    { key: "plating", label: "Plating" },
    { key: "stone", label: "Stone" },
    { key: "size", label: "Size (bangle size, e.g. 2.4)" },
    { key: "occasion", label: "Occasion" },
    { key: "care_note", label: "Care" },
    { key: "anti_tarnish", label: "Anti-tarnish", type: "bool" },
    { key: "ready_stock", label: "Ready stock", type: "bool" },
    { key: "gift_packaging", label: "Gift packaging available", type: "bool" },
  ],
  other: [{ key: "ready_stock", label: "Ready stock", type: "bool" }],
};

export function attrsFromForm(category: string | null, form: Record<string, unknown>): string {
  const fields = ATTR_FIELDS[category ?? "other"] ?? ATTR_FIELDS.other!;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = form["a_" + f.key];
    if (f.type === "bool") out[f.key] = v === "on" || v === "1" || v === "true";
    else if (typeof v === "string" && v.trim()) out[f.key] = v.trim().slice(0, 80);
  }
  return JSON.stringify(out);
}

export const PRODUCT_LIMIT = (plan: string | null) => (plan === "support" ? 200 : 20);

/** Detects jpg/png/webp from magic bytes (never trust the client-declared type). */
export function sniffImage(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Stores an uploaded image in R2 when available. Returns public path or null. */
export async function saveImage(env: Env, shopId: string, file: File): Promise<string | null> {
  if (!env.MEDIA) return null;
  const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const ext = types[file.type];
  if (!ext || file.size > 5 * 1024 * 1024 || file.size === 0) return null;
  const buf = await file.arrayBuffer();
  if (sniffImage(new Uint8Array(buf)) !== ext) return null; // the real bytes must match the declared type
  const key = `shops/${shopId}/${newId()}.${ext}`;
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: file.type } });
  return `/media/${key}`;
}
