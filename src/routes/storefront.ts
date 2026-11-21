import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../types";
import { resolveShop } from "../middleware/tenant";
import { sameOrigin } from "../middleware/security";
import { t } from "../i18n/hinglish";
import { newId } from "../lib/id";
import { hmac, timingSafeEqual } from "../lib/auth";
import { secretOf } from "../lib/secret";
import { rateLimit, clientIp } from "../lib/rate";
import { email, whatsappText } from "../lib/notify";
import { PALETTES, defaultTheme, placeholderSvg } from "../lib/theme";
import { safeUrl } from "../lib/html";
import { homePage, productPage, cartPage, checkoutPage, orderPage, trackPage, privacyPage, manifestFor, iconSvg, SW_JS, type ProductRow, type OrderView } from "../views/storefront";

export const storefront = new Hono<AppBindings>();

storefront.use("/s/:slug/*", resolveShop);
storefront.use("/s/:slug/api/*", sameOrigin);

const PRODUCT_COLS =
  "p.id, p.name, p.description, p.category, p.price, p.mrp, p.stock, p.sold_out, p.attributes_json, (SELECT url FROM product_images WHERE product_id = p.id AND shop_id = p.shop_id ORDER BY sort LIMIT 1) AS image";

async function logView(c: { env: AppBindings["Bindings"] }, shopId: string, status: string, type: string, meta: object) {
  if (status !== "preview") return;
  try {
    await c.env.DB.prepare("INSERT INTO preview_events (id, shop_id, at, type, meta_json) VALUES (?,?,?,?,?)")
      .bind(newId(), shopId, new Date().toISOString(), type, JSON.stringify(meta))
      .run();
  } catch {
    /* analytics must never break the page */
  }
}

// ---------- JSON: shop info & products ----------
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
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_COLS} FROM products p WHERE p.shop_id = ? AND p.active = 1 ORDER BY p.created_at DESC LIMIT 100`,
  )
    .bind(c.var.shop.id)
    .all();
  return c.json({ products: results });
});

storefront.get("/s/:slug/api/products/:id", async (c) => {
  const shopId = c.var.shop.id;
  const product = await c.env.DB.prepare(`SELECT ${PRODUCT_COLS} FROM products p WHERE p.id = ? AND p.shop_id = ? AND p.active = 1`)
    .bind(c.req.param("id"), shopId)
    .first();
  if (!product) return c.json({ error: t.productNotFound }, 404);
  const { results: images } = await c.env.DB.prepare("SELECT url, sort, is_stock FROM product_images WHERE product_id = ? AND shop_id = ? ORDER BY sort")
    .bind(c.req.param("id"), shopId)
    .all();
  return c.json({ product, images });
});

// ---------- Cart pricing (server is the source of truth for prices) ----------
const itemsSchema = z.array(z.object({ id: z.string().min(1).max(40), qty: z.number().int().min(1).max(10) })).min(1).max(20);

async function priceLines(c: { env: AppBindings["Bindings"] }, shopId: string, items: z.infer<typeof itemsSchema>) {
  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const p = await c.env.DB.prepare(`SELECT ${PRODUCT_COLS} FROM products p WHERE p.id = ? AND p.shop_id = ? AND p.active = 1`).bind(it.id, shopId).first<ProductRow>();
    if (!p) {
      lines.push({ id: it.id, name: "Product hata diya gaya", price: 0, qty: it.qty, image: null, available: false });
      continue;
    }
    const available = p.sold_out !== 1 && p.stock >= it.qty;
    if (available) subtotal += p.price * it.qty;
    lines.push({ id: p.id, name: p.name, price: p.price, qty: it.qty, image: safeUrl(p.image) || null, available });
  }
  return { lines, subtotal };
}

storefront.post("/s/:slug/api/cart/price", async (c) => {
  const body = z.object({ items: itemsSchema }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: t.invalidInput }, 400);
  return c.json(await priceLines(c, c.var.shop.id, body.data.items));
});

// ---------- Orders ----------
const orderSchema = z.object({
  items: itemsSchema,
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  address: z.string().trim().min(8).max(300),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  city: z.string().trim().min(2).max(60),
  payment_method: z.enum(["upi_manual", "cod"]),
});

async function trackKey(env: AppBindings["Bindings"], shopId: string, number: number) {
  return (await hmac(secretOf(env), `order:${shopId}:${number}`)).slice(0, 24);
}

export async function notifySeller(env: AppBindings["Bindings"], shop: { name: string; email: string | null; whatsapp: string | null; phone: string | null }, subject: string, text: string) {
  await email(env, shop.email, subject, text);
  const wa = (shop.whatsapp || shop.phone || "").replace(/\D/g, "");
  if (wa) await whatsappText(env, wa.length === 10 ? "91" + wa : wa, `${subject}\n${text}`);
}

storefront.post("/s/:slug/api/orders", async (c) => {
  const shop = c.var.shop;
  if (shop.status === "preview") return c.json({ error: "Ye preview hai. Order live hone ke baad hi liye ja sakte hain." }, 403);
  if (!rateLimit(`order:${clientIp(c.req.raw)}`, 8, 10 * 60_000)) return c.json({ error: "Thodi der baad try karein." }, 429);
  const parsed = orderSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: t.invalidInput }, 400);
  const d = parsed.data;
  if (d.payment_method === "upi_manual" && !shop.upi_id) return c.json({ error: "Is dukaan par UPI abhi chalu nahi hai. Cash on delivery chunein." }, 400);

  // Merge duplicate lines, then price from DB.
  const merged = new Map<string, number>();
  for (const it of d.items) merged.set(it.id, Math.min(10, (merged.get(it.id) ?? 0) + it.qty));
  const items = [...merged].map(([id, qty]) => ({ id, qty }));
  const { lines, subtotal } = await priceLines(c, shop.id, items);
  if (lines.some((l) => !l.available)) return c.json({ error: "Kuch products ab available nahi hain. Cart check karein." }, 409);

  // Reserve stock atomically per line; roll back on any failure.
  const reserved: { id: string; qty: number }[] = [];
  for (const l of lines) {
    const r = (await c.env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND shop_id = ? AND stock >= ?").bind(l.qty, l.id, shop.id, l.qty).run()) as { meta?: { changes?: number } };
    if ((r.meta?.changes ?? 0) < 1) {
      for (const x of reserved) await c.env.DB.prepare("UPDATE products SET stock = stock + ? WHERE id = ? AND shop_id = ?").bind(x.qty, x.id, shop.id).run();
      return c.json({ error: "Stock khatam ho gaya. Cart check karein." }, 409);
    }
    reserved.push({ id: l.id, qty: l.qty });
  }

  const orderId = newId();
  const now = new Date().toISOString();
  const status = "placed";
  const payStatus = d.payment_method === "cod" ? "cod" : "pending";
  let number = 0;
  for (let attempt = 0; attempt < 4 && !number; attempt++) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO orders (id, shop_id, number, created_at, buyer_name, buyer_phone, address, pincode, city, subtotal, shipping, total, payment_method, payment_status, status)
         VALUES (?,?,(SELECT COALESCE(MAX(number),0)+1 FROM orders WHERE shop_id = ?),?,?,?,?,?,?,?,0,?,?,?,?)`,
      )
        .bind(orderId, shop.id, shop.id, now, d.name, d.phone, d.address, d.pincode, d.city, subtotal, subtotal, d.payment_method, payStatus, status)
        .run();
      const row = await c.env.DB.prepare("SELECT number FROM orders WHERE id = ?").bind(orderId).first<{ number: number }>();
      number = row?.number ?? 0;
    } catch {
      /* unique(shop_id, number) collision: retry */
    }
  }
  if (!number) {
    for (const x of reserved) await c.env.DB.prepare("UPDATE products SET stock = stock + ? WHERE id = ? AND shop_id = ?").bind(x.qty, x.id, shop.id).run();
    return c.json({ error: t.somethingWrong }, 500);
  }
  for (const l of lines) {
    await c.env.DB.prepare("INSERT INTO order_items (id, order_id, shop_id, product_id, name, qty, price) VALUES (?,?,?,?,?,?,?)").bind(newId(), orderId, shop.id, l.id, l.name, l.qty, l.price).run();
  }
  await c.env.DB.prepare("INSERT INTO order_events (id, order_id, shop_id, at, type, detail) VALUES (?,?,?,?,?,?)").bind(newId(), orderId, shop.id, now, "placed", d.payment_method).run();

  await notifySeller(c.env, shop as never, `Naya order #${number}`, `${d.name}, ${d.city}. Total ₹${subtotal}. Payment: ${d.payment_method === "cod" ? "COD" : "UPI (UTR ka intezar)"}. Portal me dekhein.`);
  const k = await trackKey(c.env, shop.id, number);
  return c.json({ ok: true, number, url: `/s/${shop.slug}/order/${number}?k=${k}` }, 201);
});

async function loadOrder(c: { env: AppBindings["Bindings"] }, shopId: string, number: number): Promise<(OrderView & { id: string; buyer_phone: string }) | null> {
  const o = await c.env.DB.prepare("SELECT id, number, status, payment_status, payment_method, total, courier, tracking_id, tracking_url, buyer_name, buyer_phone FROM orders WHERE shop_id = ? AND number = ?")
    .bind(shopId, number)
    .first<Omit<OrderView, "items"> & { id: string; buyer_phone: string }>();
  if (!o) return null;
  const { results } = await c.env.DB.prepare("SELECT name, qty, price FROM order_items WHERE order_id = ? AND shop_id = ?").bind(o.id, shopId).all<{ name: string; qty: number; price: number }>();
  return { ...o, items: results };
}

storefront.post("/s/:slug/api/orders/:number/proof", async (c) => {
  const shop = c.var.shop;
  if (!rateLimit(`proof:${clientIp(c.req.raw)}`, 10, 10 * 60_000)) return c.json({ error: "Thodi der baad try karein." }, 429);
  const body = z.object({ k: z.string().min(10).max(60), utr: z.string().regex(/^[A-Za-z0-9]{6,30}$/) }).safeParse(await c.req.json().catch(() => null));
  const number = Number(c.req.param("number"));
  if (!body.success || !Number.isInteger(number)) return c.json({ error: "UTR sahi nahi hai." }, 400);
  if (!timingSafeEqual(body.data.k, await trackKey(c.env, shop.id, number))) return c.json({ error: t.productNotFound }, 403);
  const o = await loadOrder(c, shop.id, number);
  if (!o || o.payment_method !== "upi_manual" || !["pending", "proof_uploaded", "rejected"].includes(o.payment_status)) return c.json({ error: "Is order par payment ki zarurat nahi." }, 400);
  await c.env.DB.prepare("UPDATE orders SET utr = ?, payment_status = 'proof_uploaded' WHERE id = ? AND shop_id = ?").bind(body.data.utr, o.id, shop.id).run();
  await c.env.DB.prepare("INSERT INTO order_events (id, order_id, shop_id, at, type, detail) VALUES (?,?,?,?,?,?)").bind(newId(), o.id, shop.id, new Date().toISOString(), "proof", body.data.utr).run();
  await notifySeller(c.env, shop as never, `Order #${number}: payment ka UTR aaya`, `UTR ${body.data.utr}, ₹${o.total}. Bank me paisa dekh kar portal me "Payment confirm" karein.`);
  return c.json({ ok: true });
});

// ---------- HTML pages ----------
storefront.get("/s/:slug", async (c) => {
  const shop = c.var.shop;
  const { results } = await c.env.DB.prepare(`SELECT ${PRODUCT_COLS} FROM products p WHERE p.shop_id = ? AND p.active = 1 ORDER BY p.created_at DESC LIMIT 100`).bind(shop.id).all<ProductRow>();
  await logView(c, shop.id, shop.status, "view", { page: "home" });
  return c.html(homePage(shop, results));
});

storefront.get("/s/:slug/p/:id", async (c) => {
  const shop = c.var.shop;
  const p = await c.env.DB.prepare(`SELECT ${PRODUCT_COLS} FROM products p WHERE p.id = ? AND p.shop_id = ? AND p.active = 1`).bind(c.req.param("id"), shop.id).first<ProductRow>();
  if (!p) return c.html(trackPage(shop, t.productNotFound), 404);
  const { results: images } = await c.env.DB.prepare("SELECT url FROM product_images WHERE product_id = ? AND shop_id = ? ORDER BY sort").bind(p.id, shop.id).all<{ url: string }>();
  await logView(c, shop.id, shop.status, "view", { page: "product", id: p.id });
  return c.html(productPage(shop, p, images));
});

storefront.get("/s/:slug/cart", (c) => c.html(cartPage(c.var.shop)));
storefront.get("/s/:slug/checkout", (c) => c.html(checkoutPage(c.var.shop)));
storefront.get("/s/:slug/privacy", (c) => c.html(privacyPage(c.var.shop)));
storefront.get("/s/:slug/track", (c) => c.html(trackPage(c.var.shop)));

storefront.get("/s/:slug/track/go", async (c) => {
  const shop = c.var.shop;
  if (!rateLimit(`track:${clientIp(c.req.raw)}`, 15, 10 * 60_000)) return c.html(trackPage(shop, "Thodi der baad try karein."), 429);
  const number = Number(c.req.query("number"));
  const phone = (c.req.query("phone") ?? "").replace(/\D/g, "").slice(-10);
  const o = Number.isInteger(number) ? await loadOrder(c, shop.id, number) : null;
  if (!o || o.buyer_phone !== phone) return c.html(trackPage(shop, "Order number ya mobile number match nahi hua."), 404);
  return c.redirect(`/s/${shop.slug}/order/${number}?k=${await trackKey(c.env, shop.id, number)}`);
});

storefront.get("/s/:slug/order/:number", async (c) => {
  const shop = c.var.shop;
  const number = Number(c.req.param("number"));
  const k = c.req.query("k") ?? "";
  if (!Number.isInteger(number) || !timingSafeEqual(k, await trackKey(c.env, shop.id, number))) return c.html(trackPage(shop, "Order dekhne ke liye order number aur mobile number daalein."), 403);
  const o = await loadOrder(c, shop.id, number);
  if (!o) return c.html(trackPage(shop, "Order nahi mila."), 404);
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  return c.html(orderPage(shop, o, k));
});

storefront.get("/s/:slug/manifest.webmanifest", (c) => c.body(JSON.stringify(manifestFor(c.var.shop)), 200, { "content-type": "application/manifest+json" }));
storefront.get("/s/:slug/icon.svg", (c) => c.body(iconSvg(c.var.shop), 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));
storefront.get("/s/:slug/sw.js", (c) => c.body(SW_JS, 200, { "content-type": "application/javascript", "service-worker-allowed": `/s/${c.var.shop.slug}/` }));

// ---------- Public media (shop images only; payment proofs are never public) ----------
export const media = new Hono<AppBindings>();
media.get("/ph/:file", (c) => {
  const seed = c.req.param("file").replace(/\.svg$/, "").slice(0, 60);
  const label = (c.req.query("l") ?? "").slice(0, 28);
  const pal = PALETTES[defaultTheme("x", null).palette]!;
  return c.body(placeholderSvg(seed, label, pal), 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=31536000, immutable" });
});
media.get("/media/*", async (c) => {
  if (!c.env.MEDIA) return c.notFound();
  const key = decodeURIComponent(c.req.path.replace(/^\/media\//, ""));
  if (!key.startsWith("shops/") || key.includes("..")) return c.notFound();
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType ?? "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
});
