import { html, esc, raw, rupees, safeUrl, Raw } from "../lib/html";
import { PALETTES, FONT_PAIRS, parseTheme, logoSvg, type Theme } from "../lib/theme";
import type { Shop } from "../types";
import { LANGS, isRtl, trFor, type Lang, type Tr, type UiKey } from "../i18n";
import { en } from "../i18n/ui-en";

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  mrp: number | null;
  stock: number;
  sold_out: number;
  attributes_json: string | null;
  image?: string | null;
}

const variantOf = (shop: Shop) => (shop.category === "jewellery" || shop.template_id?.startsWith("jewellery") ? "jewellery" : "dress");
const base = (shop: Shop) => `/s/${shop.slug}`;
export const waLink = (num: string | null, text: string) => {
  const d = (num ?? "").replace(/\D/g, "");
  if (!d) return "";
  const full = d.length === 10 ? "91" + d : d;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};

function css(variant: "dress" | "jewellery", themeId: string): string {
  const p = PALETTES[themeId]!;
  const f = FONT_PAIRS[variant]!;
  const sq = variant === "jewellery";
  return `
:root{--bg:${p.bg};--surface:${p.surface};--text:${p.text};--muted:${p.muted};--primary:${p.primary};--on-primary:${p.onPrimary};--accent:${p.accent};--border:${p.border};--display:${f.display};--body:${f.body};--r:${sq ? "4px" : "14px"}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:400 16px/1.6 var(--body);padding-bottom:84px}
img,svg{max-width:100%;display:block}a{color:inherit}
h1,h2,h3{font-family:var(--display);line-height:1.12;margin:0;letter-spacing:${sq ? "0" : "-.015em"};font-weight:${sq ? 600 : 700}}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.preview{background:var(--text);color:var(--bg);font-size:14px;text-align:center;padding:8px 12px}
.ann{background:var(--primary);color:var(--on-primary);font-size:14px;text-align:center;padding:8px 12px}
header.top{position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:1px solid var(--border)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;min-height:64px;gap:12px}
.logo{color:var(--primary);text-decoration:none;font-family:var(--display)}
.cartbtn{position:relative;display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 16px;border:1px solid var(--border);border-radius:999px;background:var(--surface);text-decoration:none;font-weight:600}
.cartbtn b{min-width:22px;height:22px;border-radius:11px;background:var(--primary);color:var(--on-primary);font-size:13px;display:inline-grid;place-items:center}
.hero{position:relative;overflow:hidden;background:var(--primary);color:var(--on-primary)}
.hero::before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,.2) 0 3px,transparent 3.5px),radial-gradient(circle at 50% 50%,rgba(255,255,255,.1) 0 6px,transparent 6.5px);background-size:26px 26px,52px 52px;background-position:0 0,13px 13px;-webkit-mask-image:linear-gradient(100deg,#000 0%,rgba(0,0,0,.15) 62%,transparent 80%);mask-image:linear-gradient(100deg,#000 0%,rgba(0,0,0,.15) 62%,transparent 80%)}
.hero .wrap{position:relative;padding-top:56px;padding-bottom:64px}
.hero h1{font-size:clamp(34px,8vw,64px);max-width:15ch}
.hero p{font-size:18px;max-width:34ch;margin:16px 0 28px;opacity:.92}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border-radius:var(--r);border:2px solid transparent;font:600 16px var(--body);text-decoration:none;cursor:pointer;background:var(--primary);color:var(--on-primary)}
.btn.light{background:var(--on-primary);color:var(--primary)}
.btn.ghost{background:transparent;color:var(--text);border-color:var(--border)}
.btn.wa{background:#1f8f4d;color:#fff}
.btn:disabled{opacity:.5;cursor:not-allowed}
.lehariya{height:14px;background:repeating-linear-gradient(135deg,var(--accent) 0 8px,var(--primary) 8px 16px,var(--surface) 16px 24px)}
section{padding:40px 0}
section h2{font-size:clamp(26px,5vw,36px);margin-bottom:20px}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:20px;scrollbar-width:thin}
.chip{flex:none;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--border);background:var(--surface);font:500 15px var(--body);cursor:pointer;color:var(--text)}
.chip[aria-pressed=true]{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
@media(min-width:760px){.grid{grid-template-columns:repeat(4,1fr);gap:20px}}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;text-decoration:none;display:flex;flex-direction:column}
.card .im{aspect-ratio:${sq ? "1/1" : "4/5"};background:var(--border)}
.card .im img{width:100%;height:100%;object-fit:cover}
.card .tx{padding:12px 14px 16px}
.card h3{font-size:${sq ? 20 : 17}px;margin-bottom:6px}
.price{font-weight:600}.mrp{color:var(--muted);text-decoration:line-through;margin-left:6px;font-weight:400;font-size:14px}
.tag{display:inline-block;font-size:13px;padding:2px 10px;border-radius:999px;background:var(--border);color:var(--text)}
.tag.so{background:var(--text);color:var(--bg)}
.story p{max-width:60ch;font-size:18px}
.info{display:grid;gap:12px}
.footer{background:var(--text);color:var(--bg);padding:36px 0 120px}
.footer a{color:var(--bg)}
.footer small{opacity:.75}
.pd{display:grid;gap:24px;padding:24px 0}
@media(min-width:800px){.pd{grid-template-columns:1fr 1fr;gap:40px}}
.pd .im{border-radius:var(--r);overflow:hidden;aspect-ratio:${sq ? "1/1" : "4/5"};background:var(--border)}
.pd .im img{width:100%;height:100%;object-fit:cover}
.attrs{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--surface);border-top:1px solid var(--border);padding:10px 16px;display:flex;gap:10px;justify-content:center}
.bar .btn{flex:1;max-width:260px}
label{display:block;font-weight:600;margin:14px 0 6px}
input,select,textarea{width:100%;min-height:48px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);font:400 16px var(--body);color:var(--text)}
textarea{min-height:96px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px}
.line{display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.line img{width:64px;height:80px;object-fit:cover;border-radius:8px}
.qty{display:inline-flex;align-items:center;gap:6px}.qty button{width:40px;height:40px;border-radius:50%;border:1px solid var(--border);background:var(--surface);font-size:20px;cursor:pointer}
.total{display:flex;justify-content:space-between;font-size:20px;font-weight:700;padding-top:14px}
.timeline{display:grid;gap:0;margin:16px 0;padding:0;list-style:none}
.timeline li{position:relative;padding:0 0 18px 30px;color:var(--muted)}
.timeline li::before{content:"";position:absolute;left:6px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--border)}
.timeline li::after{content:"";position:absolute;left:11px;top:19px;bottom:-5px;width:2px;background:var(--border)}
.timeline li:last-child::after{display:none}
.timeline li.done{color:var(--text);font-weight:600}.timeline li.done::before{background:var(--primary)}
.note{background:var(--border);border-radius:var(--r);padding:12px 14px;font-size:15px}
.err{color:#b3261e;font-weight:600}.ok{color:#1b6b3a;font-weight:600}
.sr{position:absolute;left:-9999px}
@media(prefers-reduced-motion:no-preference){.hero h1{animation:rise .6s ease-out both}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}}
`;
}

const CLIENT_KEYS = ["addedToCart", "cartEmpty", "unavailable", "decrease", "increase", "networkError", "errInvalid", "errSomething", "utrInvalid", "utrThanks"] as const;

const CLIENT_JS = `
(function(){
var slug=document.body.dataset.slug,K='vd_cart_'+slug,T=window.T||{};
function get(){try{return JSON.parse(localStorage.getItem(K)||'[]')}catch(e){return[]}}
function set(c){try{localStorage.setItem(K,JSON.stringify(c))}catch(e){}badge()}
function badge(){var n=get().reduce(function(a,b){return a+b.qty},0);document.querySelectorAll('[data-count]').forEach(function(e){e.textContent=n})}
window.VD={get:get,set:set,add:function(id){var c=get(),f=c.find(function(x){return x.id===id});if(f)f.qty=Math.min(f.qty+1,10);else c.push({id:id,qty:1});set(c)}};
badge();
document.querySelectorAll('[data-add]').forEach(function(b){b.addEventListener('click',function(){VD.add(b.dataset.add);var o=b.textContent;b.textContent=T.addedToCart||'Added to cart';setTimeout(function(){b.textContent=o},1400)})});
var chips=document.querySelectorAll('.chip');
chips.forEach(function(ch){ch.addEventListener('click',function(){chips.forEach(function(x){x.setAttribute('aria-pressed','false')});ch.setAttribute('aria-pressed','true');var c=ch.dataset.cat;document.querySelectorAll('.card[data-cat]').forEach(function(card){card.style.display=(!c||card.dataset.cat===c)?'':'none'})})});
var ls=document.getElementById('langsel');
if(ls)ls.addEventListener('change',function(){var u=new URL(location.href);u.searchParams.set('lang',ls.value);location.href=u.toString()});
})();
`;

const EXTRA_CSS = `.lang{min-height:40px;max-width:120px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;padding:0 8px;margin-inline-start:auto;margin-inline-end:8px}
[dir=rtl] .bar,[dir=rtl] .line{direction:rtl}`;

const jsonForScript = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

export function layout(shop: Shop, L: Lang, title: string, body: Raw | string, opts: { script?: string; desc?: string } = {}): string {
  const T = trFor(L);
  const theme = parseTheme(shop.theme_json, shop.name, shop.category);
  const variant = variantOf(shop);
  const p = PALETTES[theme.palette]!;
  const logo = theme.logo.mode === "upload" && safeUrl(theme.logo.url) ? `<img src="${esc(safeUrl(theme.logo.url))}" alt="${esc(shop.name)}" height="44">` : logoSvg(theme.logo, p.primary, p.accent);
  const preview = shop.status === "preview";
  const meta = LANGS.find((l) => l.code === L)!;
  const fontFam = meta.font ? meta.font.replace(/\+/g, " ") : "";
  const scriptFont = meta.font ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${meta.font}:wght@400;600;700&display=swap"><style>body,button,input,select,textarea,h1,h2,h3,.btn{font-family:'${fontFam}',system-ui,sans-serif}h1,h2,h3{letter-spacing:0;font-style:normal}</style>` : "";
  const clientT: Record<string, string> = {};
  for (const k of CLIENT_KEYS) clientT[k] = T(k);
  const langSel = `<select id="langsel" class="lang" aria-label="${esc(T("language"))}">${LANGS.map((l) => `<option value="${l.code}"${l.code === L ? " selected" : ""} lang="${l.code}">${esc(l.name)}</option>`).join("")}</select>`;
  return `<!doctype html><html lang="${L}" dir="${isRtl(L) ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(opts.desc ?? shop.tagline ?? shop.name)}"><meta name="theme-color" content="${p.primary}">
<link rel="manifest" href="${base(shop)}/manifest.webmanifest">${preview ? '<meta name="robots" content="noindex,nofollow">' : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONT_PAIRS[variant]!.link}">${scriptFont}
<style>${css(variant, theme.palette)}${EXTRA_CSS}</style></head>
<body data-slug="${esc(shop.slug)}">
${preview ? `<div class="preview">${esc(T("previewBanner", { shop: shop.name }))}</div>` : ""}
<header class="top"><div class="wrap"><a class="logo" href="${base(shop)}" aria-label="${esc(shop.name)}">${logo}</a>${langSel}<a class="cartbtn" href="${base(shop)}/cart">${esc(T("cart"))} <b data-count>0</b></a></div></header>
${body}
<script>window.T=${jsonForScript(clientT)};</script>
<script>${CLIENT_JS}${opts.script ?? ""}</script>
<script>if('serviceWorker' in navigator){navigator.serviceWorker.register('${base(shop)}/sw.js',{scope:'${base(shop)}/'}).catch(function(){})}</script>
</body></html>`;
}

function card(shop: Shop, T: Tr, pr: ProductRow): Raw {
  const sold = pr.sold_out === 1 || pr.stock <= 0;
  const img = safeUrl(pr.image);
  return html`<a class="card" href="${base(shop)}/p/${pr.id}" data-cat="${pr.category ?? ""}">
<div class="im">${img ? raw(`<img src="${esc(img)}" alt="${esc(pr.name)}" loading="lazy" width="400" height="500">`) : ""}</div>
<div class="tx"><h3>${pr.name}</h3><div><span class="price">${rupees(pr.price)}</span>${pr.mrp && pr.mrp > pr.price ? html`<span class="mrp">${rupees(pr.mrp)}</span>` : ""}</div>${sold ? html`<span class="tag so">${T("soldOut")}</span>` : ""}</div></a>`;
}

export function homePage(shop: Shop, L: Lang, products: ProductRow[]): string {
  const T = trFor(L);
  const theme = parseTheme(shop.theme_json, shop.name, shop.category);
  const jewel = variantOf(shop) === "jewellery";
  const sn = theme.logo.text || shop.name;
  // Seller-written text wins; empty means "use the translated default for the buyer's language".
  const headline = theme.hero.headline || T(jewel ? "heroHeadlineJewel" : "heroHeadlineDress", { name: sn });
  const sub = theme.hero.sub || T(jewel ? "heroSubJewel" : "heroSubDress");
  const cta = theme.hero.cta || T("heroCta");
  const announcement = theme.announcement || T("announcement");
  const story = theme.story || T("story", { shop: shop.name });
  const cats = [...new Set(products.map((x) => x.category).filter(Boolean))] as string[];
  const wa = waLink(shop.whatsapp || shop.phone, `Hi, I found ${shop.name} on your website.`);
  const sec: Record<string, () => Raw | string> = {
    announcement_bar: () => html`<div class="ann">${announcement}</div>`,
    hero: () => html`<div class="hero"><div class="wrap"><h1>${headline}</h1><p>${sub}</p><a class="btn light" href="#collection">${cta}</a></div></div><div class="lehariya" aria-hidden="true"></div>`,
    categories: () => "",
    featured_products: () => html`<section id="collection"><div class="wrap"><h2>${T("collection")}</h2>
${cats.length > 1 ? html`<div class="chips" role="group" aria-label="${T("collection")}"><button class="chip" aria-pressed="true" data-cat="">${T("all")}</button>${cats.map((c) => html`<button class="chip" aria-pressed="false" data-cat="${c}">${c}</button>`)}</div>` : ""}
${products.length ? html`<div class="grid">${products.map((x) => card(shop, T, x))}</div>` : html`<div class="panel">${T("noProducts")}</div>`}</div></section>`,
    story: () => html`<section class="story"><div class="wrap"><h2>${shop.name}</h2><p>${story}</p></div></section>`,
    location: () =>
      shop.address || shop.maps_url
        ? html`<section><div class="wrap"><h2>${T("visitStore")}</h2><div class="panel info">${shop.address ? html`<div>${shop.address}</div>` : ""}${safeUrl(shop.maps_url) ? html`<div><a class="btn ghost" href="${safeUrl(shop.maps_url)}" rel="noopener">${T("openMaps")}</a></div>` : ""}</div></div></section>`
        : "",
    footer: () => html`<footer class="footer"><div class="wrap"><h3>${shop.name}</h3><p>${[shop.phone ? `${T("phoneLabel")}: ${shop.phone}` : "", shop.instagram ? `Instagram: ${shop.instagram}` : ""].filter(Boolean).join("  |  ")}</p><p><a href="${base(shop)}/track">${T("trackOrder")}</a>  |  <a href="${base(shop)}/privacy">${T("privacy")}</a></p><small>${T("poweredBy")}</small></div></footer>`,
  };
  const body = theme.sections.map((s) => String(sec[s]?.() ?? "")).join("\n");
  const bar = wa ? `<div class="bar"><a class="btn wa" href="${esc(wa)}" rel="noopener">${esc(T("askOnWhatsapp"))}</a></div>` : "";
  return layout(shop, L, `${shop.name}${shop.tagline ? " | " + shop.tagline : ""}`, raw(body + bar));
}

export function productPage(shop: Shop, L: Lang, pr: ProductRow, images: { url: string }[]): string {
  const T = trFor(L);
  let attrs: Record<string, unknown> = {};
  try {
    attrs = pr.attributes_json ? JSON.parse(pr.attributes_json) : {};
  } catch {
    attrs = {};
  }
  const label = (k: string) => {
    const key = `attr_${k}` as UiKey;
    return en[key] ? T(key) : k.replace(/_/g, " ");
  };
  const sold = pr.sold_out === 1 || pr.stock <= 0;
  const img = safeUrl(images[0]?.url);
  const wa = waLink(shop.whatsapp || shop.phone, `Hi, I would like to ask about "${pr.name}".`);
  const body = html`<div class="wrap"><div class="pd">
<div class="im">${img ? raw(`<img src="${esc(img)}" alt="${esc(pr.name)}" width="800" height="1000">`) : ""}</div>
<div><h1 style="font-size:clamp(28px,6vw,40px)">${pr.name}</h1>
<p style="font-size:22px;margin:10px 0"><span class="price">${rupees(pr.price)}</span>${pr.mrp && pr.mrp > pr.price ? html`<span class="mrp">${rupees(pr.mrp)}</span>` : ""}</p>
${sold ? html`<span class="tag so">${T("soldOut")}</span>` : pr.stock <= 3 ? html`<span class="tag">${T("onlyLeft", { n: pr.stock })}</span>` : ""}
<div class="attrs">${Object.entries(attrs).filter(([, v]) => v !== "" && v !== null && v !== undefined).map(([k, v]) => html`<span class="tag">${label(k)}: ${Array.isArray(v) ? v.join(", ") : v === true ? T("yes") : v === false ? T("no") : String(v)}</span>`)}</div>
<p>${pr.description ?? ""}</p>
<p><a href="${base(shop)}">${T("moreProducts")}</a></p></div></div></div>
<div class="bar"><button class="btn" data-add="${pr.id}" ${sold ? "disabled" : ""}>${sold ? T("soldOut") : T("addToCart")}</button>${wa ? html`<a class="btn wa" href="${wa}" rel="noopener">${T("whatsapp")}</a>` : ""}</div>`;
  return layout(shop, L, `${pr.name} | ${shop.name}`, body, { desc: pr.description ?? pr.name });
}

export function cartPage(shop: Shop, L: Lang): string {
  const T = trFor(L);
  const body = html`<div class="wrap" style="padding-top:24px"><h1 style="font-size:32px;margin-bottom:12px">${T("yourCart")}</h1><div id="lines" class="panel">${T("cartLoading")}</div>
<div id="sum" style="display:none"><div class="total"><span>${T("total")}</span><span id="tot"></span></div><p class="note">${T("deliveryNote")}</p><p><a class="btn" href="${base(shop)}/checkout">${T("checkout")}</a></p></div>
<p><a href="${base(shop)}">${T("continueShopping")}</a></p></div>`;
  const script = `
(function(){var slug=document.body.dataset.slug,T=window.T;
function R(){var c=VD.get();var L=document.getElementById('lines');
if(!c.length){L.textContent=T.cartEmpty;document.getElementById('sum').style.display='none';return}
fetch('/s/'+slug+'/api/cart/price',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:c})}).then(function(r){return r.json()}).then(function(d){
L.innerHTML='';d.lines.forEach(function(l){var el=document.createElement('div');el.className='line';
var im=document.createElement('img');im.alt='';if(l.image)im.src=l.image;el.appendChild(im);
var m=document.createElement('div');var n=document.createElement('strong');n.textContent=l.name;m.appendChild(n);var q=document.createElement('div');q.className='qty';
var mi=document.createElement('button');mi.textContent='-';mi.setAttribute('aria-label',T.decrease);var qq=document.createElement('span');qq.textContent=l.qty;var pl=document.createElement('button');pl.textContent='+';pl.setAttribute('aria-label',T.increase);
q.appendChild(mi);q.appendChild(qq);q.appendChild(pl);m.appendChild(q);
if(!l.available){var w=document.createElement('div');w.className='err';w.textContent=T.unavailable;m.appendChild(w)}
el.appendChild(m);var pr=document.createElement('div');pr.textContent='₹'+(l.price*l.qty).toLocaleString('en-IN');el.appendChild(pr);
mi.onclick=function(){ch(l.id,-1)};pl.onclick=function(){ch(l.id,1)};L.appendChild(el)});
document.getElementById('tot').textContent='₹'+d.subtotal.toLocaleString('en-IN');document.getElementById('sum').style.display=''})}
function ch(id,dq){var c=VD.get();var f=c.find(function(x){return x.id===id});if(!f)return;f.qty+=dq;c=c.filter(function(x){return x.qty>0});VD.set(c);R()}
R()})();`;
  return layout(shop, L, `${T("cart")} | ${shop.name}`, body, { script });
}

export function checkoutPage(shop: Shop, L: Lang): string {
  const T = trFor(L);
  const body = html`<div class="wrap" style="padding-top:24px;max-width:560px"><h1 style="font-size:32px;margin-bottom:8px">${T("orderDetails")}</h1>
${shop.status === "preview" ? html`<p class="note">${T("previewNoOrders")}</p>` : ""}
<form id="f" class="panel" novalidate>
<label for="n">${T("fullName")}</label><input id="n" name="name" autocomplete="name" required maxlength="80">
<label for="p">${T("mobile")}</label><input id="p" name="phone" inputmode="numeric" autocomplete="tel" required maxlength="10" pattern="[6-9][0-9]{9}" placeholder="${T("mobileHint")}">
<label for="a">${T("address")}</label><textarea id="a" name="address" autocomplete="street-address" required maxlength="300"></textarea>
<label for="z">${T("pincode")}</label><input id="z" name="pincode" inputmode="numeric" autocomplete="postal-code" required maxlength="6" pattern="[1-9][0-9]{5}">
<label for="c">${T("city")}</label><input id="c" name="city" autocomplete="address-level2" required maxlength="60">
<label for="m">${T("payHow")}</label><select id="m" name="payment_method"><option value="upi_manual">${T("payUpi")}</option><option value="cod">${T("payCod")}</option></select>
<p id="msg" class="err" role="alert"></p>
<button class="btn" type="submit" style="width:100%">${T("placeOrder")}</button></form></div>`;
  const script = `
(function(){var slug=document.body.dataset.slug,T=window.T;var f=document.getElementById('f'),msg=document.getElementById('msg');
f.addEventListener('submit',function(e){e.preventDefault();msg.textContent='';var c=VD.get();if(!c.length){msg.textContent=T.cartEmpty;return}
var d=Object.fromEntries(new FormData(f).entries());d.items=c;
var b=f.querySelector('button');b.disabled=true;
fetch('/s/'+slug+'/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){
if(!x.ok){msg.textContent=x.j.error||T.errSomething;b.disabled=false;return}
VD.set([]);location.href=x.j.url}).catch(function(){msg.textContent=T.networkError;b.disabled=false})})})();`;
  return layout(shop, L, `${T("checkout")} | ${shop.name}`, body, { script });
}

const STEPS = ["placed", "confirmed", "packed", "dispatched", "delivered"] as const;
const STEP_KEY = { placed: "stepPlaced", confirmed: "stepConfirmed", packed: "stepPacked", dispatched: "stepDispatched", delivered: "stepDelivered" } as const;

export interface OrderView {
  number: number;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  courier: string | null;
  tracking_id: string | null;
  tracking_url: string | null;
  buyer_name: string;
  items: { name: string; qty: number; price: number }[];
}

export function orderPage(shop: Shop, L: Lang, o: OrderView, key: string): string {
  const T = trFor(L);
  const idx = Math.max(0, STEPS.indexOf(o.status as (typeof STEPS)[number]));
  const cancelled = o.status === "cancelled" || o.status === "returned";
  const upi = shop.upi_id && o.payment_method === "upi_manual" && (o.payment_status === "pending" || o.payment_status === "proof_uploaded" || o.payment_status === "rejected");
  const upiLink = upi ? `upi://pay?pa=${encodeURIComponent(shop.upi_id!)}&pn=${encodeURIComponent(shop.name)}&am=${o.total}&cu=INR&tn=${encodeURIComponent("Order " + o.number)}` : "";
  const body = html`<div class="wrap" style="padding-top:24px;max-width:600px"><h1 style="font-size:32px">${T("orderNo", { n: o.number })}</h1><p>${T("orderGreeting", { name: o.buyer_name, shop: shop.name })}</p>
<div class="panel">${o.items.map((i) => html`<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${i.name} x ${i.qty}</span><span>${rupees(i.price * i.qty)}</span></div>`)}<div class="total"><span>${T("total")}</span><span>${rupees(o.total)}</span></div></div>
${upi ? html`<div class="panel" style="margin-top:16px"><h3 style="font-size:22px">${T("payNow")}</h3>
${o.payment_status === "rejected" ? html`<p class="err">${T("payRejected")}</p>` : ""}
<p>${T("upiId")}: <strong>${shop.upi_id}</strong></p>
<p><a class="btn" href="${upiLink}">${T("payViaUpi", { amount: rupees(o.total) })}</a></p>
<p class="note">${T("payNote")}</p>
<label for="utr">${T("utrLabel")}</label><input id="utr" maxlength="30" placeholder="${T("utrPlaceholder")}">
<p id="pm" role="status"></p><button class="btn" id="sub" type="button">${T("submitUtr")}</button></div>` : ""}
${o.payment_method === "cod" ? html`<p class="note">${T("codNote")}</p>` : ""}
${cancelled ? html`<p class="err">${T(o.status === "cancelled" ? "orderCancelled" : "orderReturned")}</p>` : html`<ol class="timeline">${STEPS.map((s, i) => html`<li class="${i <= idx ? "done" : ""}">${T(STEP_KEY[s])}</li>`)}</ol>`}
${o.courier || o.tracking_id ? html`<div class="panel"><strong>${T("courier")}:</strong> ${o.courier ?? "-"}<br><strong>${T("trackingId")}:</strong> ${o.tracking_id ?? "-"}${safeUrl(o.tracking_url) ? html`<p><a class="btn ghost" href="${safeUrl(o.tracking_url)}" rel="noopener">${T("trackOnCourier")}</a></p>` : ""}</div>` : ""}
<p><a href="${base(shop)}">${T("backToShop")}</a></p></div>`;
  const script = upi
    ? `(function(){var T=window.T;var b=document.getElementById('sub');if(!b)return;b.onclick=function(){var u=document.getElementById('utr').value.trim();var m=document.getElementById('pm');if(u.length<6){m.className='err';m.textContent=T.utrInvalid;return}
b.disabled=true;fetch('/s/'+document.body.dataset.slug+'/api/orders/${o.number}/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({k:${JSON.stringify(key)},utr:u})}).then(function(r){return r.json()}).then(function(j){m.className=j.error?'err':'ok';m.textContent=j.error||T.utrThanks;b.disabled=false}).catch(function(){m.className='err';m.textContent=T.networkError;b.disabled=false})}})();`
    : "";
  return layout(shop, L, `${T("orderNo", { n: o.number })} | ${shop.name}`, body, { script });
}

export function trackPage(shop: Shop, L: Lang, error?: string): string {
  const T = trFor(L);
  const body = html`<div class="wrap" style="padding-top:24px;max-width:520px"><h1 style="font-size:32px;margin-bottom:12px">${T("trackOrder")}</h1>
<form class="panel" method="get" action="${base(shop)}/track/go"><label for="no">${T("orderNumber")}</label><input id="no" name="number" inputmode="numeric" required maxlength="8">
<label for="ph">${T("phoneUsed")}</label><input id="ph" name="phone" inputmode="numeric" required maxlength="10">
${error ? html`<p class="err" role="alert">${error}</p>` : ""}<p><button class="btn" type="submit">${T("viewStatus")}</button></p></form></div>`;
  return layout(shop, L, `${T("trackOrder")} | ${shop.name}`, body);
}

export function privacyPage(shop: Shop, L: Lang): string {
  const T = trFor(L);
  const body = html`<div class="wrap" style="padding-top:24px;max-width:640px"><h1 style="font-size:32px;margin-bottom:12px">${T("privacy")}</h1>
<p>${T("privacyP1", { shop: shop.name })}</p>
<p>${T("privacyP2", { shop: shop.name })}</p>
<p>${T("privacyP3")}${shop.phone ? ": " + shop.phone : ""}</p></div>`;
  return layout(shop, L, `${T("privacy")} | ${shop.name}`, body);
}

export function manifestFor(shop: Shop): object {
  const theme = parseTheme(shop.theme_json, shop.name, shop.category);
  const p = PALETTES[theme.palette]!;
  return { name: shop.name, short_name: theme.logo.text || shop.name, start_url: `${base(shop)}/`, scope: `${base(shop)}/`, display: "standalone", background_color: p.bg, theme_color: p.primary, lang: "en", icons: [{ src: `${base(shop)}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}

export function iconSvg(shop: Shop): string {
  const theme = parseTheme(shop.theme_json, shop.name, shop.category);
  const p = PALETTES[theme.palette]!;
  const ini = (theme.logo.text || shop.name).split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase().replace(/[<>&]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="${p.primary}"/><circle cx="96" cy="96" r="70" fill="none" stroke="${p.accent}" stroke-width="5"/><text x="96" y="116" text-anchor="middle" font-family="sans-serif" font-size="64" font-weight="700" fill="${p.onPrimary}">${ini}</text></svg>`;
}

export const SW_JS = `const C='vd-v1';self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.pathname.includes('/api/'))return;
e.respondWith(fetch(r).then(res=>{if(res.ok&&(r.mode==='navigate'||/\\.(svg|webp|png|jpg)$/.test(u.pathname))){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||new Response('You are offline. Please try again shortly.',{status:503}))))});`;

export type { Theme };
