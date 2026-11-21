import { html, esc, raw, rupees, safeUrl, Raw } from "../lib/html";
import type { Shop } from "../types";
import { ATTR_FIELDS, CATEGORY_DEFAULTS } from "../lib/seller";
import { PALETTES, parseTheme, ALL_SECTIONS } from "../lib/theme";

const CSS = `
:root{--bg:#F7F6F4;--s:#fff;--t:#1d1b20;--m:#6b6772;--p:#3B2A8C;--ac:#E8A33D;--b:#e5e2e8;--ok:#1b6b3a;--er:#b3261e}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font:400 16px/1.55 'Hind',system-ui,sans-serif;padding-bottom:84px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:22px 0 8px}a{color:var(--p)}
.w{max-width:720px;margin:0 auto;padding:16px}
.top{background:var(--s);border-bottom:1px solid var(--b);padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.top b{font-size:17px}
.tabs{position:fixed;left:0;right:0;bottom:0;background:var(--s);border-top:1px solid var(--b);display:grid;grid-template-columns:repeat(5,1fr);z-index:9}
.tabs a{display:grid;place-items:center;min-height:62px;font-size:13px;text-decoration:none;color:var(--m);padding:6px}
.tabs a[aria-current=page]{color:var(--p);font-weight:700;box-shadow:inset 0 3px var(--p)}
.card{background:var(--s);border:1px solid var(--b);border-radius:14px;padding:14px;margin:10px 0}
.row{display:flex;justify-content:space-between;gap:10px;align-items:center}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}.stats .card{margin:0}.stats strong{font-size:28px;display:block}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border-radius:12px;border:0;background:var(--p);color:#fff;font:600 16px 'Hind',sans-serif;text-decoration:none;cursor:pointer}
.btn.s{background:var(--s);color:var(--t);border:1px solid var(--b)}.btn.ok{background:var(--ok)}.btn.er{background:var(--er)}.btn.big{width:100%;min-height:56px;font-size:18px}
label{display:block;font-weight:600;margin:14px 0 6px}
input,select,textarea{width:100%;min-height:48px;padding:10px 12px;border:1px solid var(--b);border-radius:10px;font:400 16px 'Hind',sans-serif;background:#fff;color:var(--t)}
textarea{min-height:90px}input[type=checkbox]{width:24px;min-height:24px}.cb{display:flex;gap:10px;align-items:center;margin:12px 0}.cb label{margin:0}
.chip{display:inline-block;padding:2px 10px;border-radius:99px;font-size:13px;background:var(--b)}.chip.g{background:#d9f0e1;color:var(--ok)}.chip.y{background:#fdecc8;color:#7a5200}.chip.r{background:#f9dedc;color:var(--er)}
.msg{background:#e8f5ec;color:var(--ok);padding:10px 14px;border-radius:10px;margin:10px 0}.msg.e{background:#f9dedc;color:var(--er)}
.thumb{width:56px;height:70px;border-radius:8px;object-fit:cover;background:var(--b)}
.muted{color:var(--m);font-size:14px}.sw{display:flex;gap:8px;flex-wrap:wrap}.sw label{display:flex;align-items:center;gap:8px;margin:0;font-weight:500;border:1px solid var(--b);border-radius:10px;padding:8px 12px;background:#fff}.sw input{width:auto;min-height:auto}
:focus-visible{outline:3px solid var(--ac);outline-offset:2px}
`;

type Tab = "home" | "orders" | "products" | "shop" | "help";

export function portal(shop: Shop, active: Tab, title: string, body: Raw | string, flash?: { m?: string; e?: string }): string {
  const tab = (id: Tab, href: string, label: string) => `<a href="${href}" ${active === id ? 'aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Vedhin</title><meta name="robots" content="noindex"><meta name="theme-color" content="#3B2A8C">
<link rel="manifest" href="/seller/manifest.webmanifest"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600&display=swap"><style>${CSS}</style></head><body>
<div class="top"><b>${esc(shop.name)}</b><form method="post" action="/seller/logout"><button class="btn s" style="min-height:40px">Logout</button></form></div>
<div class="w">${flash?.m ? `<div class="msg" role="status">${esc(flash.m)}</div>` : ""}${flash?.e ? `<div class="msg e" role="alert">${esc(flash.e)}</div>` : ""}${body}</div>
<nav class="tabs" aria-label="Menu">${tab("home", "/seller", "Home")}${tab("orders", "/seller/orders", "Orders")}${tab("products", "/seller/products", "Products")}${tab("shop", "/seller/shop", "Meri dukaan")}${tab("help", "/seller/help", "Help")}</nav></body></html>`;
}

export function loginPage(error?: string): string {
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seller login | Vedhin</title><meta name="robots" content="noindex"><style>${CSS}</style></head><body><div class="w" style="padding-top:48px"><h1>Seller login</h1>
${error ? `<div class="msg e" role="alert">${esc(error)}</div>` : ""}
<div class="card"><p>Login ke liye Vedhin Technology se mila hua <strong>login link</strong> kholiye. Link WhatsApp par aata hai.</p><p class="muted">Link purana ho gaya ho to Vedhin se naya link maang lein.</p></div></div></body></html>`;
}

export const ORDER_FILTERS: Record<string, string> = { new: "Naye", payment: "Payment check karein", pack: "Pack karna hai", dispatched: "Bheje gaye", all: "Sab" };

export function chipFor(o: { status: string; payment_status: string }): Raw {
  if (o.status === "cancelled") return html`<span class="chip r">Cancel</span>`;
  if (o.status === "delivered") return html`<span class="chip g">Delivered</span>`;
  if (o.status === "dispatched") return html`<span class="chip g">Dispatched</span>`;
  if (o.payment_status === "proof_uploaded") return html`<span class="chip y">Payment check karein</span>`;
  if (o.payment_status === "pending") return html`<span class="chip y">Payment baaki</span>`;
  if (o.status === "packed") return html`<span class="chip">Packed</span>`;
  return html`<span class="chip g">Pack karna hai</span>`;
}

export function productForm(shop: Shop, p: Record<string, unknown> | null, attrs: Record<string, unknown>): Raw {
  const cat = shop.category ?? "other";
  const cats = CATEGORY_DEFAULTS[cat] ?? CATEGORY_DEFAULTS.other!;
  const fields = ATTR_FIELDS[cat] ?? ATTR_FIELDS.other!;
  const v = (k: string) => (p ? (p[k] as string | number | null) ?? "" : "");
  return html`<label for="name">Product ka naam</label><input id="name" name="name" required maxlength="80" value="${v("name")}">
<label for="description">Description</label><textarea id="description" name="description" maxlength="600">${v("description")}</textarea>
<label for="category">Category</label><select id="category" name="category">${cats.map((c) => html`<option ${String(v("category")).toLowerCase() === c.toLowerCase() ? "selected" : ""}>${c}</option>`)}</select>
<div class="row"><div style="flex:1"><label for="price">Price (₹)</label><input id="price" name="price" type="number" inputmode="numeric" min="1" max="500000" required value="${v("price")}"></div>
<div style="flex:1"><label for="mrp">MRP (₹, optional)</label><input id="mrp" name="mrp" type="number" inputmode="numeric" min="0" max="500000" value="${v("mrp")}"></div></div>
<label for="stock">Kitna stock hai</label><input id="stock" name="stock" type="number" inputmode="numeric" min="0" max="9999" required value="${p ? v("stock") : 1}">
<label for="image">Photo (camera ya gallery se)</label><input id="image" name="image" type="file" accept="image/*" capture="environment">
<label for="image_url">Ya photo ka link (optional)</label><input id="image_url" name="image_url" type="url" placeholder="https://...">
<h2>Details</h2>
${fields.map((f) => (f.type === "bool" ? html`<div class="cb"><input type="checkbox" id="a_${f.key}" name="a_${f.key}" ${attrs[f.key] === true ? "checked" : ""}><label for="a_${f.key}">${f.label}</label></div>` : html`<label for="a_${f.key}">${f.label}</label><input id="a_${f.key}" name="a_${f.key}" maxlength="80" value="${(attrs[f.key] as string) ?? ""}">`))}`;
}

export function themeForm(shop: Shop): Raw {
  const th = parseTheme(shop.theme_json, shop.name, shop.category);
  return html`<label for="headline">Main headline</label><input id="headline" name="headline" maxlength="90" value="${th.hero.headline}">
<label for="sub">Headline ke neeche line</label><input id="sub" name="sub" maxlength="160" value="${th.hero.sub}">
<label for="cta">Button ka text</label><input id="cta" name="cta" maxlength="30" value="${th.hero.cta}">
<label for="announcement">Upar ki patti (offer / delivery)</label><input id="announcement" name="announcement" maxlength="120" value="${th.announcement}">
<label for="story">Dukaan ke baare me</label><textarea id="story" name="story" maxlength="600">${th.story}</textarea>
<label>Rang</label><div class="sw">${Object.values(PALETTES).map((p) => html`<label><input type="radio" name="palette" value="${p.id}" ${th.palette === p.id ? "checked" : ""}><span style="width:18px;height:18px;border-radius:50%;background:${raw(esc(p.primary))};display:inline-block"></span>${p.label}</label>`)}</div>
<label for="logo_text">Logo ka naam</label><input id="logo_text" name="logo_text" maxlength="18" value="${th.logo.text}">
<label for="logo_icon">Logo ka nishan</label><select id="logo_icon" name="logo_icon">${["lotus", "mirror", "jhumka", "bangle", "bindi"].map((i) => html`<option ${th.logo.icon === i ? "selected" : ""}>${i}</option>`)}</select>
<label for="logo_layout">Logo ka style</label><select id="logo_layout" name="logo_layout">${["stacked", "inline", "monogram"].map((i) => html`<option ${th.logo.layout === i ? "selected" : ""}>${i}</option>`)}</select>
<label>Kaunse hisse dikhane hain</label><div class="sw">${ALL_SECTIONS.filter((s) => s !== "footer").map((s) => html`<label><input type="checkbox" name="sections" value="${s}" ${th.sections.includes(s) ? "checked" : ""}>${s.replace(/_/g, " ")}</label>`)}</div>`;
}

export { rupees, safeUrl, html, raw, esc };
