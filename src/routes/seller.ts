import { Hono, type MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import type { AppBindings, Shop } from "../types";
import { sameOrigin } from "../middleware/security";
import { sha256Hex, signSession, verifySession } from "../lib/auth";
import { secretOf } from "../lib/secret";
import { rateLimit, clientIp } from "../lib/rate";
import { newId } from "../lib/id";
import { whatsappText } from "../lib/notify";
import { attrsFromForm, saveImage, PRODUCT_LIMIT } from "../lib/seller";
import { parseTheme, sanitizeThemePatch } from "../lib/theme";
import { getAiProvider } from "../ai/provider";
import { portal, loginPage, productForm, themeForm, chipFor, ORDER_FILTERS, html, raw, rupees, safeUrl } from "../views/portal";

export const seller = new Hono<AppBindings>();
seller.use("/seller/*", sameOrigin);

const SHOP_SELECT = "SELECT id, slug, name, tagline, category, status, expires_at, plan, template_id, theme_json, logo_url, phone, whatsapp, email, maps_url, address, instagram, facebook, youtube, upi_id, upi_qr_url FROM shops WHERE id = ?";
const secure = (env: AppBindings["Bindings"]) => env.APP_ENV === "production";
const SELLER_COOKIE = "vd_seller";

seller.get("/seller/manifest.webmanifest", (c) =>
  c.body(JSON.stringify({ name: "Vedhin Seller", short_name: "Seller", start_url: "/seller", scope: "/seller", display: "standalone", background_color: "#F7F6F4", theme_color: "#3B2A8C", lang: "hi", icons: [] }), 200, { "content-type": "application/manifest+json" }),
);

seller.get("/seller/login", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.html(loginPage());
  if (!rateLimit(`login:${clientIp(c.req.raw)}`, 20, 10 * 60_000)) return c.html(loginPage("Please try again shortly."), 429);
  const hash = await sha256Hex(token);
  const row = await c.env.DB.prepare("SELECT id, seller_id, expires_at, used_at FROM seller_login_tokens WHERE token_hash = ?").bind(hash).first<{ id: string; seller_id: string; expires_at: string; used_at: string | null }>();
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return c.html(loginPage("This login link has expired or was already used. Ask Vedhin for a new link."), 401);
  const upd = (await c.env.DB.prepare("UPDATE seller_login_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(new Date().toISOString(), row.id).run()) as { meta?: { changes?: number } };
  if ((upd.meta?.changes ?? 0) < 1) return c.html(loginPage("This login link was already used."), 401);
  await c.env.DB.prepare("UPDATE sellers SET last_login_at = ? WHERE id = ?").bind(new Date().toISOString(), row.seller_id).run();
  const session = await signSession({ role: "seller", id: row.seller_id, exp: Math.floor(Date.now() / 1000) + 30 * 86400 }, secretOf(c.env));
  setCookie(c, SELLER_COOKIE, session, { httpOnly: true, secure: secure(c.env), sameSite: "Lax", path: "/", maxAge: 30 * 86400 });
  return c.redirect("/seller");
});

seller.post("/seller/logout", (c) => {
  deleteCookie(c, SELLER_COOKIE, { path: "/" });
  return c.redirect("/seller/login");
});

// ---- auth guard for everything else under /seller ----
const PUBLIC_PATHS = new Set(["/seller/login", "/seller/logout", "/seller/manifest.webmanifest"]);
const guard: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next();
  const p = await verifySession(getCookie(c, SELLER_COOKIE), secretOf(c.env));
  if (!p || p.role !== "seller") return c.redirect("/seller/login");
  const s = await c.env.DB.prepare("SELECT shop_id FROM sellers WHERE id = ?").bind(p.id).first<{ shop_id: string }>();
  const shop = s ? await c.env.DB.prepare(SHOP_SELECT).bind(s.shop_id).first<Shop>() : null;
  if (!shop) return c.redirect("/seller/login");
  if (shop.status === "suspended") return c.html(loginPage("This shop is currently closed. Please contact Vedhin Technology."), 403);
  c.set("shop", shop);
  c.set("sellerId", p.id);
  await next();
};
seller.use("/seller", guard);
seller.use("/seller/*", guard);

const flash = (c: { req: { query: (k: string) => string | undefined } }) => ({ m: c.req.query("m"), e: c.req.query("e") });
const back = (path: string, m?: string, e?: string) => `${path}${m ? `?m=${encodeURIComponent(m)}` : e ? `?e=${encodeURIComponent(e)}` : ""}`;

// ---- Dashboard ----
seller.get("/seller", async (c) => {
  const shop = c.var.shop;
  const q = async (sql: string, ...b: unknown[]) => ((await c.env.DB.prepare(sql).bind(...b).first<{ n: number }>())?.n ?? 0);
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const [todayOrders, payCheck, toPack, low, total] = await Promise.all([
    q("SELECT COUNT(*) n FROM orders WHERE shop_id = ? AND substr(created_at,1,10) = ?", shop.id, today),
    q("SELECT COUNT(*) n FROM orders WHERE shop_id = ? AND payment_status = 'proof_uploaded' AND status NOT IN ('cancelled','delivered')", shop.id),
    q("SELECT COUNT(*) n FROM orders WHERE shop_id = ? AND status IN ('confirmed','packed') ", shop.id),
    q("SELECT COUNT(*) n FROM products WHERE shop_id = ? AND active = 1 AND stock <= 2", shop.id),
    q("SELECT COALESCE(SUM(total),0) n FROM orders WHERE shop_id = ? AND payment_status IN ('confirmed','cod') AND status != 'cancelled'", shop.id),
  ]);
  const link = `${new URL(c.req.url).origin}/s/${shop.slug}`;
  const body = html`<h1>Welcome</h1><p class="muted">${shop.status === "preview" ? "Your shop is in preview." : "Your shop is live."}</p>
<div class="stats"><div class="card"><strong>${todayOrders}</strong>Orders today</div><div class="card"><strong>${payCheck}</strong>Check payment</div><div class="card"><strong>${toPack}</strong>To pack or dispatch</div><div class="card"><strong>${low}</strong>Low stock</div></div>
<div class="card"><div class="muted">Confirmed sales so far</div><strong style="font-size:26px">${rupees(total)}</strong></div>
<div class="card"><strong>Your shop link</strong><p style="word-break:break-all"><a href="${link}">${link}</a></p>
<p><a class="btn s" href="https://wa.me/?text=${encodeURIComponent(`${shop.name}: ${link}`)}">Share on WhatsApp</a></p></div>
<a class="btn big" href="/seller/products/new">Add a new product</a>`;
  return c.html(portal(shop, "home", "Home", body, flash(c)));
});

// ---- Products ----
seller.get("/seller/products", async (c) => {
  const shop = c.var.shop;
  const { results } = await c.env.DB.prepare("SELECT p.id, p.name, p.price, p.stock, p.sold_out, p.source, (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort LIMIT 1) AS image FROM products p WHERE p.shop_id = ? AND p.active = 1 ORDER BY p.created_at DESC").bind(shop.id).all<{ id: string; name: string; price: number; stock: number; sold_out: number; source: string; image: string | null }>();
  const body = html`<div class="row"><h1>Products</h1><a class="btn" href="/seller/products/new">New</a></div>
${results.length ? results.map((p) => html`<div class="card"><div class="row"><div style="display:flex;gap:12px;align-items:center">${safeUrl(p.image) ? raw(`<img class="thumb" src="${safeUrl(p.image)}" alt="">`) : html`<div class="thumb"></div>`}<div><strong>${p.name}</strong><div>${rupees(p.price)} <span class="muted">stock ${p.stock}</span></div>${p.source === "demo" ? html`<span class="chip">Demo product</span>` : ""}${p.sold_out ? html`<span class="chip r">Sold out</span>` : ""}</div></div>
<a class="btn s" href="/seller/products/${p.id}">Edit</a></div></div>`) : html`<div class="card">No products yet. Tap "New" to add your first product.</div>`}`;
  return c.html(portal(shop, "products", "Products", body, flash(c)));
});

seller.get("/seller/products/new", (c) => {
  const shop = c.var.shop;
  return c.html(portal(shop, "products", "New product", html`<h1>New product</h1><form class="card" method="post" action="/seller/products" enctype="multipart/form-data">${productForm(shop, null, {})}<p><button class="btn big">Product jodein</button></p></form>`, flash(c)));
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(600).optional().default(""),
  category: z.string().trim().max(40).optional().default(""),
  price: z.coerce.number().int().min(1).max(500000),
  mrp: z.coerce.number().int().min(0).max(500000).optional().default(0),
  stock: z.coerce.number().int().min(0).max(9999),
});

async function imageFrom(c: { env: AppBindings["Bindings"] }, shopId: string, form: Record<string, unknown>): Promise<string | null> {
  const f = form.image;
  if (f instanceof File && f.size > 0) {
    const saved = await saveImage(c.env, shopId, f);
    if (saved) return saved;
  }
  const u = typeof form.image_url === "string" ? form.image_url.trim() : "";
  return /^https:\/\//i.test(u) ? u.slice(0, 500) : null;
}

seller.post("/seller/products", async (c) => {
  const shop = c.var.shop;
  const form = await c.req.parseBody();
  const parsed = productSchema.safeParse(form);
  if (!parsed.success) return c.redirect(back("/seller/products/new", undefined, "Enter a valid name, price and stock."));
  const d = parsed.data;
  const count = (await c.env.DB.prepare("SELECT COUNT(*) n FROM products WHERE shop_id = ? AND active = 1 AND source != 'demo'").bind(shop.id).first<{ n: number }>())?.n ?? 0;
  if (count >= PRODUCT_LIMIT(shop.plan)) return c.redirect(back("/seller/products", undefined, `Your plan allows up to ${PRODUCT_LIMIT(shop.plan)} products. Contact Vedhin for more.`));
  const id = newId();
  await c.env.DB.prepare("INSERT INTO products (id, shop_id, name, description, category, price, mrp, stock, active, attributes_json, created_at, source) VALUES (?,?,?,?,?,?,?,?,1,?,?,'portal')")
    .bind(id, shop.id, d.name, d.description, d.category, d.price, d.mrp || null, d.stock, attrsFromForm(shop.category, form), new Date().toISOString()).run();
  const img = await imageFrom(c, shop.id, form);
  if (img) await c.env.DB.prepare("INSERT INTO product_images (id, product_id, shop_id, url, sort, is_stock) VALUES (?,?,?,?,0,0)").bind(newId(), id, shop.id, img).run();
  // Real product replaces one stock demo product (demo items never stay beside real ones).
  await c.env.DB.prepare("UPDATE products SET active = 0 WHERE id = (SELECT id FROM products WHERE shop_id = ? AND source = 'demo' AND active = 1 ORDER BY created_at LIMIT 1) AND shop_id = ?").bind(shop.id, shop.id).run();
  await c.env.DB.prepare("INSERT INTO preview_events (id, shop_id, at, type, meta_json) VALUES (?,?,?,?,?)").bind(newId(), shop.id, new Date().toISOString(), "change", '{"what":"product_added"}').run();
  return c.redirect(back("/seller/products", "Product added."));
});

async function ownProduct(c: { env: AppBindings["Bindings"] }, shopId: string, id: string) {
  return c.env.DB.prepare("SELECT id, name, description, category, price, mrp, stock, sold_out, attributes_json FROM products WHERE id = ? AND shop_id = ? AND active = 1").bind(id, shopId).first<Record<string, unknown>>();
}

seller.get("/seller/products/:id", async (c) => {
  const shop = c.var.shop;
  const p = await ownProduct(c, shop.id, c.req.param("id"));
  if (!p) return c.redirect(back("/seller/products", undefined, "Product not found."));
  let attrs: Record<string, unknown> = {};
  try { attrs = JSON.parse((p.attributes_json as string) || "{}"); } catch { /* ignore */ }
  const body = html`<h1>Edit product</h1><form class="card" method="post" action="/seller/products/${p.id as string}" enctype="multipart/form-data">${productForm(shop, p, attrs)}<p><button class="btn big">Save</button></p></form>
<form method="post" action="/seller/products/${p.id as string}/soldout"><button class="btn s big">${p.sold_out ? "Mark as available" : "Mark as sold out"}</button></form>
<form method="post" action="/seller/products/${p.id as string}/delete" style="margin-top:12px"><button class="btn er big">Product hatayein</button></form>`;
  return c.html(portal(shop, "products", "Product", body, flash(c)));
});

seller.post("/seller/products/:id", async (c) => {
  const shop = c.var.shop;
  const id = c.req.param("id");
  if (!(await ownProduct(c, shop.id, id))) return c.redirect(back("/seller/products", undefined, "Product not found."));
  const form = await c.req.parseBody();
  const parsed = productSchema.safeParse(form);
  if (!parsed.success) return c.redirect(back(`/seller/products/${id}`, undefined, "Enter a valid name, price and stock."));
  const d = parsed.data;
  await c.env.DB.prepare("UPDATE products SET name=?, description=?, category=?, price=?, mrp=?, stock=?, attributes_json=?, sold_out = CASE WHEN ? > 0 THEN 0 ELSE sold_out END WHERE id = ? AND shop_id = ?")
    .bind(d.name, d.description, d.category, d.price, d.mrp || null, d.stock, attrsFromForm(shop.category, form), d.stock, id, shop.id).run();
  const img = await imageFrom(c, shop.id, form);
  if (img) {
    await c.env.DB.prepare("DELETE FROM product_images WHERE product_id = ? AND shop_id = ?").bind(id, shop.id).run();
    await c.env.DB.prepare("INSERT INTO product_images (id, product_id, shop_id, url, sort, is_stock) VALUES (?,?,?,?,0,0)").bind(newId(), id, shop.id, img).run();
  }
  return c.redirect(back("/seller/products", "Product saved."));
});

seller.post("/seller/products/:id/soldout", async (c) => {
  await c.env.DB.prepare("UPDATE products SET sold_out = 1 - sold_out WHERE id = ? AND shop_id = ?").bind(c.req.param("id"), c.var.shop.id).run();
  return c.redirect(back("/seller/products", "Updated."));
});
seller.post("/seller/products/:id/delete", async (c) => {
  await c.env.DB.prepare("UPDATE products SET active = 0 WHERE id = ? AND shop_id = ?").bind(c.req.param("id"), c.var.shop.id).run();
  return c.redirect(back("/seller/products", "Product hata diya."));
});

// AI draft from photo (limited, goes through AiProvider; stub unless configured)
seller.post("/seller/api/draft-from-photo", async (c) => {
  const shop = c.var.shop;
  const day = new Date().toISOString().slice(0, 10);
  const used = (await c.env.DB.prepare("SELECT COALESCE(SUM(ai_calls),0) n FROM bot_usage WHERE shop_id = ? AND day = ?").bind(shop.id, day).first<{ n: number }>())?.n ?? 0;
  const limit = shop.status === "preview" ? 10 : 30;
  if (used >= limit) return c.json({ error: "Today's AI limit is used up. Try again tomorrow or contact Vedhin." }, 429);
  const form = await c.req.parseBody();
  const f = form.image;
  if (!(f instanceof File) || f.size === 0 || f.size > 5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(f.type)) return c.json({ error: "Sahi photo chunein (5 MB tak)." }, 400);
  const bytes = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const { draft, usage } = await getAiProvider(c.env).draftProductFromPhoto({ mime: f.type, base64: btoa(bin) });
  await c.env.DB.prepare("INSERT INTO bot_usage (id, shop_id, day, ai_calls, input_tokens, output_tokens, est_cost_paise) VALUES (?,?,?,1,?,?,0)").bind(newId(), shop.id, day, usage.inputTokens, usage.outputTokens).run();
  return c.json({ draft });
});

// ---- Orders ----
const FILTER_SQL: Record<string, string> = {
  new: "status = 'placed'",
  payment: "payment_status = 'proof_uploaded' AND status NOT IN ('cancelled','delivered')",
  pack: "status IN ('confirmed','packed')",
  dispatched: "status = 'dispatched'",
  all: "1=1",
};

seller.get("/seller/orders", async (c) => {
  const shop = c.var.shop;
  const f = FILTER_SQL[c.req.query("f") ?? ""] ? (c.req.query("f") as string) : "all";
  const { results } = await c.env.DB.prepare(`SELECT id, number, created_at, buyer_name, city, total, status, payment_status, payment_method FROM orders WHERE shop_id = ? AND ${FILTER_SQL[f]} ORDER BY created_at DESC LIMIT 100`).bind(shop.id).all<{ id: string; number: number; buyer_name: string; city: string; total: number; status: string; payment_status: string }>();
  const body = html`<h1>Orders</h1><div class="sw" style="margin:10px 0">${Object.entries(ORDER_FILTERS).map(([k, label]) => html`<a class="btn ${k === f ? "" : "s"}" style="min-height:40px" href="/seller/orders?f=${k}">${label}</a>`)}</div>
${results.length ? results.map((o) => html`<a class="card" style="display:block;text-decoration:none;color:inherit" href="/seller/orders/${o.id}"><div class="row"><strong>#${o.number} ${o.buyer_name}</strong><span>${rupees(o.total)}</span></div><div class="row"><span class="muted">${o.city}</span>${chipFor(o)}</div></a>`) : html`<div class="card">No orders in this list yet.</div>`}`;
  return c.html(portal(shop, "orders", "Orders", body, flash(c)));
});

async function ownOrder(c: { env: AppBindings["Bindings"] }, shopId: string, id: string) {
  return c.env.DB.prepare("SELECT * FROM orders WHERE id = ? AND shop_id = ?").bind(id, shopId).first<Record<string, string | number | null>>();
}

seller.get("/seller/orders/:id", async (c) => {
  const shop = c.var.shop;
  const o = await ownOrder(c, shop.id, c.req.param("id"));
  if (!o) return c.redirect(back("/seller/orders", undefined, "Order not found."));
  const { results: items } = await c.env.DB.prepare("SELECT name, qty, price FROM order_items WHERE order_id = ? AND shop_id = ?").bind(o.id, shop.id).all<{ name: string; qty: number; price: number }>();
  const { results: couriers } = await c.env.DB.prepare("SELECT id, name FROM couriers ORDER BY name").all<{ id: string; name: string }>();
  const st = o.status as string, ps = o.payment_status as string;
  const canPay = o.payment_method === "upi_manual" && (ps === "proof_uploaded" || ps === "pending") && st !== "cancelled";
  const canConfirmCod = o.payment_method === "cod" && st === "placed";
  const canPack = st === "confirmed";
  const canDispatch = (st === "confirmed" || st === "packed") && (ps === "confirmed" || ps === "cod");
  const body = html`<h1>Order #${o.number as number}</h1><p>${chipFor({ status: st, payment_status: ps })}</p>
<div class="card"><strong>${o.buyer_name as string}</strong><br><a href="tel:${o.buyer_phone as string}">${o.buyer_phone as string}</a><br>${o.address as string}<br>${o.city as string} - ${o.pincode as string}</div>
<div class="card">${items.map((i) => html`<div class="row"><span>${i.name} x ${i.qty}</span><span>${rupees(i.price * i.qty)}</span></div>`)}<div class="row"><strong>Total</strong><strong>${rupees(o.total as number)}</strong></div>
<div class="muted">${o.payment_method === "cod" ? "Cash on delivery" : "UPI"}${o.utr ? " | UTR: " + o.utr : ""}</div></div>
${canPay ? html`<div class="card"><strong>Payment</strong><p class="muted">Check your bank / UPI app and confirm only after the money has arrived.</p>
<form method="post" action="/seller/orders/${o.id as string}/payment" class="row"><button name="action" value="confirm" class="btn ok" style="flex:1">Money received, confirm</button><button name="action" value="reject" class="btn er">Nahi aaya</button></form></div>` : ""}
${canConfirmCod ? html`<form method="post" action="/seller/orders/${o.id as string}/payment"><button name="action" value="confirm" class="btn ok big">Confirm COD order</button></form>` : ""}
${canPack ? html`<form method="post" action="/seller/orders/${o.id as string}/status"><button name="status" value="packed" class="btn big">Mark as packed</button></form>` : ""}
${canDispatch ? html`<form class="card" method="post" action="/seller/orders/${o.id as string}/tracking"><strong>Handed to courier</strong>
<label for="courier">Courier</label><select id="courier" name="courier">${couriers.map((x) => html`<option value="${x.id}">${x.name}</option>`)}</select>
<label for="tid">Tracking ID</label><input id="tid" name="tracking_id" required maxlength="40"><p><button class="btn big">Dispatch</button></p></form>` : ""}
${st === "dispatched" ? html`<form method="post" action="/seller/orders/${o.id as string}/status"><button name="status" value="delivered" class="btn ok big">Mark as delivered</button></form>` : ""}
${!["cancelled", "delivered", "dispatched"].includes(st) ? html`<form method="post" action="/seller/orders/${o.id as string}/status" style="margin-top:12px"><button name="status" value="cancelled" class="btn er big">Cancel order</button></form>` : ""}`;
  return c.html(portal(shop, "orders", "Order", body, flash(c)));
});

async function event(c: { env: AppBindings["Bindings"] }, orderId: string, shopId: string, type: string, detail: string) {
  await c.env.DB.prepare("INSERT INTO order_events (id, order_id, shop_id, at, type, detail) VALUES (?,?,?,?,?,?)").bind(newId(), orderId, shopId, new Date().toISOString(), type, detail).run();
}

seller.post("/seller/orders/:id/payment", async (c) => {
  const shop = c.var.shop;
  const o = await ownOrder(c, shop.id, c.req.param("id"));
  if (!o) return c.redirect(back("/seller/orders", undefined, "Order not found."));
  const action = (await c.req.parseBody()).action;
  if (o.status === "cancelled") return c.redirect(back(`/seller/orders/${o.id}`, undefined, "This cannot be done on a cancelled order."));
  if (action === "confirm") {
    await c.env.DB.prepare("UPDATE orders SET payment_status = CASE WHEN payment_method = 'cod' THEN 'cod' ELSE 'confirmed' END, status = CASE WHEN status = 'placed' THEN 'confirmed' ELSE status END WHERE id = ? AND shop_id = ?").bind(o.id, shop.id).run();
    await event(c, o.id as string, shop.id, "payment_confirmed", "seller");
    await whatsappText(c.env, "91" + (o.buyer_phone as string), `${shop.name}: your order #${o.number} is confirmed.`);
    return c.redirect(back(`/seller/orders/${o.id}`, "Order confirmed."));
  }
  if (action === "reject" && o.payment_method === "upi_manual") {
    await c.env.DB.prepare("UPDATE orders SET payment_status = 'rejected' WHERE id = ? AND shop_id = ?").bind(o.id, shop.id).run();
    await event(c, o.id as string, shop.id, "payment_rejected", "seller");
    return c.redirect(back(`/seller/orders/${o.id}`, "Payment marked as rejected. The customer can send the UTR again."));
  }
  return c.redirect(back(`/seller/orders/${o.id}`, undefined, "This action is not valid."));
});

const TRANSITIONS: Record<string, string[]> = { confirmed: ["packed", "cancelled"], placed: ["cancelled"], packed: ["cancelled"], dispatched: ["delivered"] };

seller.post("/seller/orders/:id/status", async (c) => {
  const shop = c.var.shop;
  const o = await ownOrder(c, shop.id, c.req.param("id"));
  if (!o) return c.redirect(back("/seller/orders", undefined, "Order not found."));
  const next = String((await c.req.parseBody()).status ?? "");
  if (!(TRANSITIONS[o.status as string] ?? []).includes(next)) return c.redirect(back(`/seller/orders/${o.id}`, undefined, "This change is not possible right now."));
  await c.env.DB.prepare("UPDATE orders SET status = ? WHERE id = ? AND shop_id = ?").bind(next, o.id, shop.id).run();
  if (next === "cancelled") {
    const { results } = await c.env.DB.prepare("SELECT product_id, qty FROM order_items WHERE order_id = ? AND shop_id = ?").bind(o.id, shop.id).all<{ product_id: string; qty: number }>();
    for (const it of results) await c.env.DB.prepare("UPDATE products SET stock = stock + ? WHERE id = ? AND shop_id = ?").bind(it.qty, it.product_id, shop.id).run();
  }
  await event(c, o.id as string, shop.id, next, "seller");
  return c.redirect(back(`/seller/orders/${o.id}`, "Status updated."));
});

seller.post("/seller/orders/:id/tracking", async (c) => {
  const shop = c.var.shop;
  const o = await ownOrder(c, shop.id, c.req.param("id"));
  if (!o) return c.redirect(back("/seller/orders", undefined, "Order not found."));
  if (!["confirmed", "packed"].includes(o.status as string) || !["confirmed", "cod"].includes(o.payment_status as string)) return c.redirect(back(`/seller/orders/${o.id}`, undefined, "Confirm the payment first."));
  const form = await c.req.parseBody();
  const tid = String(form.tracking_id ?? "").trim().slice(0, 40);
  if (!/^[A-Za-z0-9\-\/ ]{4,40}$/.test(tid)) return c.redirect(back(`/seller/orders/${o.id}`, undefined, "Enter a valid tracking ID."));
  const courier = await c.env.DB.prepare("SELECT name, tracking_url_template FROM couriers WHERE id = ?").bind(String(form.courier ?? "other")).first<{ name: string; tracking_url_template: string }>();
  if (!courier) return c.redirect(back(`/seller/orders/${o.id}`, undefined, "Courier chunein."));
  await c.env.DB.prepare("UPDATE orders SET status='dispatched', courier=?, tracking_id=?, tracking_url=?, dispatched_at=? WHERE id=? AND shop_id=?").bind(courier.name, tid, courier.tracking_url_template || null, new Date().toISOString(), o.id, shop.id).run();
  await event(c, o.id as string, shop.id, "dispatched", `${courier.name} ${tid}`);
  await whatsappText(c.env, "91" + (o.buyer_phone as string), `${shop.name}: your order #${o.number} has been dispatched. Courier: ${courier.name}, ID: ${tid}.`);
  return c.redirect(back(`/seller/orders/${o.id}`, "Dispatched. The customer can now see the tracking details."));
});

// ---- Shop settings and theme ----
const shopSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/).or(z.literal("")),
  whatsapp: z.string().regex(/^[6-9]\d{9}$/).or(z.literal("")),
  email: z.string().email().max(120).or(z.literal("")),
  upi_id: z.string().regex(/^[\w.\-]{2,}@[A-Za-z]{2,}$/).or(z.literal("")),
  address: z.string().max(300),
  maps_url: z.string().url().max(500).or(z.literal("")),
  instagram: z.string().max(100),
  facebook: z.string().max(100),
  youtube: z.string().max(100),
});

seller.get("/seller/shop", (c) => {
  const shop = c.var.shop;
  const v = (x: string | null) => x ?? "";
  const body = html`<h1>My shop</h1><p><a href="/s/${shop.slug}">View shop</a></p>
<form class="card" method="post" action="/seller/shop"><h2 style="margin-top:0">Contact and payment</h2>
<label for="phone">Phone</label><input id="phone" name="phone" inputmode="numeric" maxlength="10" value="${v(shop.phone)}">
<label for="whatsapp">WhatsApp number</label><input id="whatsapp" name="whatsapp" inputmode="numeric" maxlength="10" value="${v(shop.whatsapp)}">
<label for="email">Email (for new-order alerts)</label><input id="email" name="email" type="email" value="${v(shop.email)}">
<label for="upi_id">UPI ID (like name@upi)</label><input id="upi_id" name="upi_id" value="${v(shop.upi_id)}">
<label for="address">Shop address</label><textarea id="address" name="address">${v(shop.address)}</textarea>
<label for="maps_url">Google Maps link</label><input id="maps_url" name="maps_url" type="url" value="${v(shop.maps_url)}">
<label for="instagram">Instagram</label><input id="instagram" name="instagram" value="${v(shop.instagram)}">
<label for="facebook">Facebook</label><input id="facebook" name="facebook" value="${v(shop.facebook)}">
<label for="youtube">YouTube</label><input id="youtube" name="youtube" value="${v(shop.youtube)}">
<p><button class="btn big">Save</button></p></form>
<form class="card" method="post" action="/seller/theme"><h2 style="margin-top:0">Website design</h2>${themeForm(shop)}<p><button class="btn big">Save design</button></p></form>`;
  return c.html(portal(shop, "shop", "My shop", body, flash(c)));
});

seller.post("/seller/shop", async (c) => {
  const shop = c.var.shop;
  const form = await c.req.parseBody();
  const clean = Object.fromEntries(Object.keys(shopSchema.shape).map((k) => [k, typeof form[k] === "string" ? (form[k] as string).trim() : ""]));
  const parsed = shopSchema.safeParse(clean);
  if (!parsed.success) return c.redirect(back("/seller/shop", undefined, "Some details are not valid (10-digit phone, UPI ID like name@bank)."));
  const d = parsed.data;
  await c.env.DB.prepare("UPDATE shops SET phone=?, whatsapp=?, email=?, upi_id=?, address=?, maps_url=?, instagram=?, facebook=?, youtube=? WHERE id=?")
    .bind(d.phone || null, d.whatsapp || null, d.email || null, d.upi_id || null, d.address || null, d.maps_url || null, d.instagram || null, d.facebook || null, d.youtube || null, shop.id).run();
  await c.env.DB.prepare("INSERT INTO preview_events (id, shop_id, at, type, meta_json) VALUES (?,?,?,?,?)").bind(newId(), shop.id, new Date().toISOString(), "change", '{"what":"settings"}').run();
  return c.redirect(back("/seller/shop", "Saved."));
});

seller.post("/seller/theme", async (c) => {
  const shop = c.var.shop;
  const raw0 = await c.req.parseBody({ all: true });
  const input: Record<string, unknown> = { ...raw0, sections: ([] as unknown[]).concat(raw0.sections ?? []) };
  const next = sanitizeThemePatch(input, parseTheme(shop.theme_json, shop.name, shop.category));
  await c.env.DB.prepare("UPDATE shops SET theme_json = ? WHERE id = ?").bind(JSON.stringify(next), shop.id).run();
  await c.env.DB.prepare("INSERT INTO preview_events (id, shop_id, at, type, meta_json) VALUES (?,?,?,?,?)").bind(newId(), shop.id, new Date().toISOString(), "change", '{"what":"theme"}').run();
  return c.redirect(back("/seller/shop", "Design updated. Open the shop to see it."));
});

seller.get("/seller/help", (c) => {
  const shop = c.var.shop;
  const body = html`<h1>Help</h1>
<div class="card"><strong>30-second videos (coming soon)</strong><ul><li>How to add a product</li><li>What to do when an order arrives</li><li>How to confirm a payment</li><li>How to add courier and tracking ID</li><li>Dukaan ka link share kaise karein</li></ul></div>
<div class="card"><strong>Need help?</strong><p>Message Vedhin Technology on WhatsApp. For a bug, send a screenshot.</p></div>`;
  return c.html(portal(shop, "help", "Help", body));
});
