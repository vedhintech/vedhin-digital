import { Hono } from "hono";
import type { AppBindings } from "../types";
import { resolveShop } from "../middleware/tenant";
import { t } from "../i18n/hinglish";

export const storefront = new Hono<AppBindings>();

storefront.use("/s/:slug/*", resolveShop);

// Public shop info (no private fields like upi_id's internals beyond what checkout needs later).
storefront.get("/s/:slug/api/shop", (c) => {
  const s = c.var.shop;
  return c.json({
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    category: s.category,
    status: s.status,
    preview: s.status === "preview",
    theme: s.theme_json ? JSON.parse(s.theme_json) : null,
    logo_url: s.logo_url,
    contact: { phone: s.phone, whatsapp: s.whatsapp, maps_url: s.maps_url, address: s.address },
    social: { instagram: s.instagram, facebook: s.facebook, youtube: s.youtube },
  });
});

storefront.get("/s/:slug/api/products", async (c) => {
  const shopId = c.var.shop.id;
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, description, category, price, mrp, stock, sold_out, attributes_json FROM products WHERE shop_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 100",
  )
    .bind(shopId)
    .all();
  return c.json({ products: results });
});

storefront.get("/s/:slug/api/products/:id", async (c) => {
  const shopId = c.var.shop.id;
  const product = await c.env.DB.prepare(
    "SELECT id, name, description, category, price, mrp, stock, sold_out, attributes_json FROM products WHERE id = ? AND shop_id = ? AND active = 1",
  )
    .bind(c.req.param("id"), shopId)
    .first();
  if (!product) return c.json({ error: t.productNotFound }, 404);
  const { results: images } = await c.env.DB.prepare(
    "SELECT url, sort, is_stock FROM product_images WHERE product_id = ? AND shop_id = ? ORDER BY sort",
  )
    .bind(c.req.param("id"), shopId)
    .all();
  return c.json({ product, images });
});
