import type { MiddlewareHandler } from "hono";
import type { AppBindings, Shop } from "../types";
import { isValidSlug } from "../lib/slug";
import { t } from "../i18n/hinglish";

const SHOP_COLUMNS =
  "id, slug, name, tagline, category, status, expires_at, theme_json, logo_url, phone, whatsapp, maps_url, address, instagram, facebook, youtube, upi_id";

/**
 * Resolves the shop from /s/:slug and puts it in c.var.shop.
 * Every downstream query MUST use c.var.shop.id (tenant isolation).
 * Expiry is enforced here: a preview shop past expires_at is treated as expired (expires_at NULL = never).
 */
export const resolveShop: MiddlewareHandler<AppBindings> = async (c, next) => {
  const slug = c.req.param("slug") ?? "";
  if (!isValidSlug(slug)) return c.json({ error: t.shopNotFound }, 404);

  const shop = await c.env.DB.prepare(`SELECT ${SHOP_COLUMNS} FROM shops WHERE slug = ?`).bind(slug).first<Shop>();
  if (!shop) return c.json({ error: t.shopNotFound }, 404);

  if (shop.status === "suspended") return c.json({ error: t.shopSuspended }, 403);
  const expired =
    shop.status === "expired" ||
    (shop.status === "preview" && shop.expires_at !== null && new Date(shop.expires_at).getTime() < Date.now());
  if (expired) return c.json({ error: t.previewExpired }, 410);

  c.set("shop", shop);
  await next();
};
