import type { Env, Shop } from "../types";
import { newId } from "./id";
import { bot, PRICING } from "../i18n/hinglish";
import { telegram } from "./notify";
import { fetchMedia, type Incoming } from "./wa";
import { getAiProvider } from "../ai/provider";
import { parseTheme, sanitizeThemePatch, PALETTES } from "./theme";
import { createLoginToken, ensureSeller } from "./seller";
import { PRICE_RE } from "./scoring";

const SHOP_COLS = "id, slug, name, tagline, category, status, expires_at, plan, template_id, theme_json, logo_url, phone, whatsapp, email, maps_url, address, instagram, facebook, youtube, upi_id, upi_qr_url";
export const LIMITS = {
  previewMessagesPerDay: 80,
  paidMessagesPerDay: 100,
  previewAiPerDay: 20,
  paidAiPerDay: 30,
  freeChanges: 2,
  alertAtEdits: 7,
};

interface Ctx {
  kind: "seller" | "lead" | "unknown";
  phone: string;
  shop?: Shop;
  leadId?: string;
  sellerId?: string;
  name: string;
}
interface State { state: string; data: Record<string, unknown>; change_requests: number; edit_messages: number }

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

async function resolve(env: Env, phone: string): Promise<Ctx> {
  const s = await env.DB.prepare("SELECT id, shop_id, name FROM sellers WHERE phone = ?").bind(phone).first<{ id: string; shop_id: string; name: string | null }>();
  if (s) {
    const shop = await env.DB.prepare(`SELECT ${SHOP_COLS} FROM shops WHERE id = ?`).bind(s.shop_id).first<Shop>();
    if (shop) return { kind: "seller", phone, shop, sellerId: s.id, name: s.name || "Seller" };
  }
  const l = await env.DB.prepare("SELECT id, shop_id, owner_name, business_name FROM leads WHERE phone = ? AND shop_id IS NOT NULL").bind(phone).first<{ id: string; shop_id: string; owner_name: string | null; business_name: string }>();
  if (l) {
    const shop = await env.DB.prepare(`SELECT ${SHOP_COLS} FROM shops WHERE id = ?`).bind(l.shop_id).first<Shop>();
    if (shop) return { kind: "lead", phone, shop, leadId: l.id, name: l.owner_name || "Seller" };
  }
  return { kind: "unknown", phone, name: "" };
}

async function loadState(env: Env, phone: string): Promise<State> {
  const r = await env.DB.prepare("SELECT state, data_json, change_requests, edit_messages FROM bot_state WHERE phone = ?").bind(phone).first<{ state: string; data_json: string | null; change_requests: number; edit_messages: number }>();
  if (!r) return { state: "menu", data: {}, change_requests: 0, edit_messages: 0 };
  let data: Record<string, unknown> = {};
  try { data = r.data_json ? JSON.parse(r.data_json) : {}; } catch { /* reset */ }
  return { state: r.state, data, change_requests: r.change_requests ?? 0, edit_messages: r.edit_messages ?? 0 };
}
async function saveState(env: Env, phone: string, shopId: string | undefined, st: State) {
  await env.DB.prepare("INSERT INTO bot_state (phone, shop_id, state, data_json, change_requests, edit_messages, updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET shop_id=excluded.shop_id, state=excluded.state, data_json=excluded.data_json, change_requests=excluded.change_requests, edit_messages=excluded.edit_messages, updated_at=excluded.updated_at")
    .bind(phone, shopId ?? null, st.state, JSON.stringify(st.data), st.change_requests, st.edit_messages, nowIso()).run();
}

async function logMsg(env: Env, ctx: Ctx, direction: "in" | "out", kind: string, body: string, waId?: string) {
  await env.DB.prepare("INSERT INTO chat_messages (id, shop_id, lead_id, at, direction, kind, body, wa_message_id) VALUES (?,?,?,?,?,?,?,?)")
    .bind(newId(), ctx.shop?.id ?? null, ctx.leadId ?? null, nowIso(), direction, kind, body.slice(0, 1000), waId ?? null).run();
}

async function event(env: Env, shopId: string, type: string, meta: object) {
  await env.DB.prepare("INSERT INTO preview_events (id, shop_id, at, type, meta_json) VALUES (?,?,?,?,?)").bind(newId(), shopId, nowIso(), type, JSON.stringify(meta)).run();
}

const siteLink = (env: Env, shop: Shop, base: string) => `${base}/s/${shop.slug}`;

function toBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function normalize(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

const STOP_RE = /^(stop|unsubscribe|band karo|band kar do|rok do|mat bhejo|nahi chahiye)\b/;
const GREET_RE = /^(hi|hello|hey|namaste|namaskar|menu|start|hii+|help me)\b/;
const FRUSTRATION_RE = /(bekar|bakwas|kaam nahi kar|nahi chal raha|bug|error|dhokha|fraud|paise wapas|refund)/;
const CHANGE_RE = /(badal|change|hatao|hata do|lagao|laga do|add kar|bada karo|chhota karo|naya design)/;

const PALETTE_WORDS: [RegExp, string][] = [
  [/(gulabi|pink)/, "gulabi_jaipur"], [/(indigo|neela|blue)/, "indigo_bandhej"], [/(maroon|laal|lal|red|gold)/, "royal_maroon_gold"],
  [/(emerald|hara|green)/, "emerald_pearl"], [/(black|white|mono|safed|kala)/, "mono"],
];

async function findProducts(env: Env, shopId: string, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  const { results } = await env.DB.prepare("SELECT id, name FROM products WHERE shop_id = ? AND active = 1").bind(shopId).all<{ id: string; name: string }>();
  const exact = results.filter((p) => p.name.toLowerCase() === q.toLowerCase());
  if (exact.length === 1) return exact;
  return results.filter((p) => words.every((w) => p.name.toLowerCase().includes(w)));
}

async function aiBudget(env: Env, shop: Shop): Promise<boolean> {
  const used = (await env.DB.prepare("SELECT COALESCE(SUM(ai_calls),0) n FROM bot_usage WHERE shop_id = ? AND day = ?").bind(shop.id, today()).first<{ n: number }>())?.n ?? 0;
  return used < (shop.status === "preview" ? LIMITS.previewAiPerDay : LIMITS.paidAiPerDay);
}
async function recordAi(env: Env, shopId: string, u: { inputTokens: number; outputTokens: number }) {
  await env.DB.prepare("INSERT INTO bot_usage (id, shop_id, day, ai_calls, input_tokens, output_tokens, est_cost_paise) VALUES (?,?,?,1,?,?,0)").bind(newId(), shopId, today(), u.inputTokens, u.outputTokens).run();
}

async function savePhoto(env: Env, shopId: string, bytes: ArrayBuffer, mime: string): Promise<string | null> {
  if (!env.MEDIA) return null;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const key = `shops/${shopId}/${newId()}.${ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  return `/media/${key}`;
}

/** Main entry. Returns replies to send; all side effects (DB, alerts) happen here. */
export async function handleIncoming(env: Env, msg: Incoming, baseUrl: string): Promise<string[]> {
  const phone = msg.from.replace(/\D/g, "").slice(-10);
  const ctx = await resolve(env, phone);
  const text = normalize(msg.text);
  const kind = msg.type === "text" ? "text" : msg.type;

  if (ctx.kind === "unknown") {
    await telegram(env, `Anjaan number ne WhatsApp kiya (…${phone.slice(-4)}): "${msg.text.slice(0, 80)}"`);
    return [bot.unknownNumber];
  }
  const shop = ctx.shop!;

  // STOP works everywhere and first: revoke consent, mark lost, never message again.
  if (msg.type === "text" && STOP_RE.test(text)) {
    await logMsg(env, ctx, "in", "text", msg.text, msg.id);
    await env.DB.prepare("UPDATE consents SET revoked_at = ? WHERE phone = ? AND revoked_at IS NULL").bind(nowIso(), phone).run();
    if (ctx.leadId) await env.DB.prepare("UPDATE leads SET stage = 'lost' WHERE id = ? AND stage != 'paid'").bind(ctx.leadId).run();
    await telegram(env, `STOP: ${shop.name} (…${phone.slice(-4)}) ne band karne ko kaha.`);
    return [bot.stopped];
  }

  // Daily message cap (cost protection). Never silently fail.
  const cap = shop.status === "preview" ? LIMITS.previewMessagesPerDay : LIMITS.paidMessagesPerDay;
  const todays = (await env.DB.prepare("SELECT COUNT(*) n FROM chat_messages WHERE shop_id = ? AND direction = 'in' AND substr(at,1,10) = ?").bind(shop.id, today()).first<{ n: number }>())?.n ?? 0;
  await logMsg(env, ctx, "in", kind, msg.text, msg.id);
  if (todays >= cap) {
    if (todays === cap) await telegram(env, `LIMIT: ${shop.name} ka aaj ka bot limit (${cap}) poora.`);
    return [bot.limitHit];
  }

  // Re-opt-in record when a lead writes first (user-initiated contact).
  if (ctx.leadId) {
    const has = await env.DB.prepare("SELECT 1 x FROM consents WHERE lead_id = ? AND revoked_at IS NULL").bind(ctx.leadId).first();
    if (!has) await env.DB.prepare("INSERT INTO consents (id, lead_id, phone, channel, granted_at, granted_by, note) VALUES (?,?,?,?,?,?,?)").bind(newId(), ctx.leadId, phone, "whatsapp_optin", nowIso(), "seller", "user-initiated message").run();
  }

  const st = await loadState(env, phone);
  const reply = await route(env, ctx, st, msg, text, baseUrl);
  await saveState(env, phone, shop.id, st);
  for (const r of reply) await logMsg(env, ctx, "out", "text", r);
  return reply;
}

async function route(env: Env, ctx: Ctx, st: State, msg: Incoming, text: string, baseUrl: string): Promise<string[]> {
  const shop = ctx.shop!;
  const link = siteLink(env, shop, baseUrl);

  if (msg.type === "audio") return [bot.voiceNo];

  // --- photo handling (add-product flow) ---
  if (msg.type === "image") {
    if (!(await aiBudget(env, shop))) return [bot.aiLimit];
    const media = await fetchMedia(env, msg.mediaId ?? "");
    const base64 = media ? toBase64(media.bytes) : "";
    if (!media && env.WHATSAPP_TOKEN) return [bot.noMedia];
    const { draft, usage } = await getAiProvider(env).draftProductFromPhoto({ mime: media?.mime ?? "image/jpeg", base64 });
    await recordAi(env, shop.id, usage);
    const url = media ? await savePhoto(env, shop.id, media.bytes, media.mime) : null;
    st.state = "await_price";
    st.data = { name: draft.name, description: draft.description, category: draft.category, image: url };
    return [bot.gotDraft(draft.name, draft.description)];
  }
  if (msg.type === "other") return [bot.unknown];

  // --- stateful product flow ---
  if (st.state === "await_photo") {
    if (GREET_RE.test(text)) { st.state = "menu"; return [bot.menu(ctx.name)]; }
    return [bot.needPhoto];
  }
  if (st.state === "await_price" || st.state === "await_stock") {
    if (GREET_RE.test(text)) { st.state = "menu"; st.data = {}; return [bot.menu(ctx.name)]; }
    const n = Number(text.replace(/[^\d]/g, ""));
    if (!Number.isInteger(n) || n <= 0) return [st.state === "await_price" ? bot.askPrice : bot.askStock];
    if (st.state === "await_price") {
      if (n > 500000) return [bot.askPrice];
      st.data.price = n; st.state = "await_stock";
      return [bot.askStock];
    }
    if (n > 9999) return [bot.askStock];
    const d = st.data as { name: string; description: string; category: string; price: number; image: string | null };
    const id = newId();
    await env.DB.prepare("INSERT INTO products (id, shop_id, name, description, category, price, stock, active, attributes_json, created_at, source) VALUES (?,?,?,?,?,?,?,1,'{}',?,'whatsapp')").bind(id, shop.id, d.name, d.description, d.category, d.price, n, nowIso()).run();
    if (d.image) await env.DB.prepare("INSERT INTO product_images (id, product_id, shop_id, url, sort, is_stock) VALUES (?,?,?,?,0,0)").bind(newId(), id, shop.id, d.image).run();
    await env.DB.prepare("UPDATE products SET active = 0 WHERE id = (SELECT id FROM products WHERE shop_id = ? AND source = 'demo' AND active = 1 ORDER BY created_at LIMIT 1) AND shop_id = ?").bind(shop.id, shop.id).run();
    await event(env, shop.id, "change", { what: "product_added_via_whatsapp" });
    st.state = "menu"; st.data = {}; st.edit_messages++;
    await maybeAlertEdits(env, ctx, st);
    return [bot.productAdded(d.name, link)];
  }

  // --- greetings and numbered menu ---
  if (GREET_RE.test(text)) { st.state = "menu"; return [bot.menu(ctx.name)]; }
  if (/^[1-8]$/.test(text)) return menuChoice(env, ctx, st, Number(text), baseUrl);
  if (text === "design") return [bot.design];

  // --- design commands (rule based, zero AI cost) ---
  const dm = text.match(/^(rang|color|colour|logo|headline|heading|banner|offer|patti)\s+(.+)$/);
  // "logo ko bada karo" is a custom request, not a new logo text: let it fall through to change handling.
  if (dm && !CHANGE_RE.test(dm[2]!)) {
    const key = dm[1]!;
    const val = msg.text.trim().replace(/^\S+\s+/, "").slice(0, 120);
    const patch: Record<string, unknown> = {};
    if (/^(rang|color|colour)$/.test(key)) {
      const pal = PALETTE_WORDS.find(([re]) => re.test(text))?.[1];
      if (!pal || !PALETTES[pal]) return [bot.designBad];
      patch.palette = pal;
    } else if (key === "logo") patch.logo_text = val;
    else if (/^head/.test(key)) patch.headline = val;
    else patch.announcement = val;
    const theme = sanitizeThemePatch(patch, parseTheme(shop.theme_json, shop.name, shop.category));
    await env.DB.prepare("UPDATE shops SET theme_json = ? WHERE id = ?").bind(JSON.stringify(theme), shop.id).run();
    shop.theme_json = JSON.stringify(theme);
    await event(env, shop.id, "change", { what: "theme_via_whatsapp", key });
    st.edit_messages++;
    await maybeAlertEdits(env, ctx, st);
    return [bot.designDone(link)];
  }

  // --- price / stock / sold out ---
  const so = text.match(/^(?:sold ?out|khatam)\s+(.+)$/) ?? text.match(/^(.+?)\s+(?:sold ?out|khatam)$/);
  if (so) return stockOp(env, shop, so[1]!, { soldOut: true });
  const stk = text.match(/^stock\s+(.+?)\s+(\d{1,4})$/);
  if (stk) return stockOp(env, shop, stk[1]!, { stock: Number(stk[2]) });
  const pr = text.match(/^(.+?)\s+(?:price\s+|rate\s+|₹\s?|rs\.?\s?)?(\d{2,6})\s*(?:rs|rupaye|rupay|₹)?$/);
  if (pr && !/^(plan|rate|price|stock|dispatch|paid)$/.test(pr[1]!)) return stockOp(env, shop, pr[1]!, { price: Number(pr[2]) });

  // --- affirmation after "extra change" prompt ---
  if (/^(haan|ha|yes|ok|theek hai)$/.test(text) && st.data.pendingExtra) {
    st.data = {};
    await telegram(env, `EXTRA CHANGE: ${shop.name} ne ₹${PRICING.extraChange} wale extra change ko haan kaha.`);
    return [bot.callNoted];
  }

  // --- escalation keywords ---
  if (FRUSTRATION_RE.test(text)) {
    await telegram(env, `HELP: ${shop.name} (…${ctx.phone.slice(-4)}) pareshan lag raha hai: "${msg.text.slice(0, 100)}"`);
    return [bot.callNoted];
  }
  if (PRICE_RE.test(text)) {
    await telegram(env, `PRICE SAWAL: ${shop.name} (…${ctx.phone.slice(-4)}): "${msg.text.slice(0, 100)}"`);
    return [bot.plan];
  }

  // --- custom change request (counts toward free changes) ---
  if (CHANGE_RE.test(text)) {
    st.change_requests++;
    await telegram(env, `CHANGE REQUEST #${st.change_requests}: ${shop.name}: "${msg.text.slice(0, 120)}"`);
    if (shop.status === "live" && st.change_requests > LIMITS.freeChanges) { st.data = { pendingExtra: true }; return [bot.changePaid]; }
    return [bot.changeNoted];
  }

  // --- limited AI intent fallback ---
  st.data.unknownStreak = ((st.data.unknownStreak as number) ?? 0) + 1;
  if (await aiBudget(env, shop)) {
    const { usage } = await getAiProvider(env).classifyIntent(msg.text);
    await recordAi(env, shop.id, usage);
  }
  if ((st.data.unknownStreak as number) >= 2) {
    st.data.unknownStreak = 0;
    await telegram(env, `ATKA HUA: ${shop.name} (…${ctx.phone.slice(-4)}) bot samajh nahi paya: "${msg.text.slice(0, 100)}"`);
  }
  return [bot.unknown];
}

async function maybeAlertEdits(env: Env, ctx: Ctx, st: State) {
  if (st.edit_messages === LIMITS.alertAtEdits) await telegram(env, `INTERESTED: ${ctx.shop!.name} ne ${st.edit_messages} changes kiye. Call karne ka time.`);
}

async function stockOp(env: Env, shop: Shop, q: string, op: { price?: number; stock?: number; soldOut?: boolean }): Promise<string[]> {
  const found = await findProducts(env, shop.id, q.trim());
  if (!found.length) return [bot.noProduct];
  if (found.length > 1) return [bot.pickProduct(found.slice(0, 4).map((p) => p.name))];
  const p = found[0]!;
  if (op.price !== undefined) {
    if (op.price > 500000) return [bot.askPrice];
    await env.DB.prepare("UPDATE products SET price = ? WHERE id = ? AND shop_id = ?").bind(op.price, p.id, shop.id).run();
    return [bot.priceSet(p.name, op.price)];
  }
  if (op.stock !== undefined) {
    await env.DB.prepare("UPDATE products SET stock = ?, sold_out = CASE WHEN ? > 0 THEN 0 ELSE sold_out END WHERE id = ? AND shop_id = ?").bind(op.stock, op.stock, p.id, shop.id).run();
    return [bot.stockSet(p.name, op.stock)];
  }
  await env.DB.prepare("UPDATE products SET sold_out = 1 WHERE id = ? AND shop_id = ?").bind(p.id, shop.id).run();
  return [bot.soldOut(p.name)];
}

async function menuChoice(env: Env, ctx: Ctx, st: State, n: number, baseUrl: string): Promise<string[]> {
  const shop = ctx.shop!;
  const link = siteLink(env, shop, baseUrl);
  switch (n) {
    case 1: return [bot.design];
    case 2: st.state = "await_photo"; return [bot.askPhoto];
    case 3: return ["Price badalne ke liye likhein: kangan set 499\nStock: stock kangan set 10\nSold out: kangan set khatam"];
    case 4: {
      if (shop.status === "preview" || ctx.kind !== "seller") return [bot.ordersPreview];
      const q = async (sql: string) => ((await env.DB.prepare(sql).bind(shop.id).first<{ n: number }>())?.n ?? 0);
      const pay = await q("SELECT COUNT(*) n FROM orders WHERE shop_id = ? AND payment_status = 'proof_uploaded' AND status NOT IN ('cancelled','delivered')");
      const pack = await q("SELECT COUNT(*) n FROM orders WHERE shop_id = ? AND status IN ('confirmed','packed')");
      const token = await createLoginToken(env, ctx.sellerId!);
      return [bot.ordersSummary(pay, pack, `${baseUrl}/seller/login?token=${token}`)];
    }
    case 5: return [bot.shopLink(link)];
    case 6: return [bot.plan];
    case 7:
      await env.DB.prepare("INSERT INTO chat_messages (id, shop_id, lead_id, at, direction, kind, body) VALUES (?,?,?,?,'in','call_request','call chahiye')").bind(newId(), shop.id, ctx.leadId ?? null, nowIso()).run();
      await telegram(env, `CALL CHAHIYE: ${shop.name} (${ctx.phone}). Jaldi call karein.`);
      return [bot.callNoted];
    default: {
      if (ctx.kind === "seller") {
        const token = await createLoginToken(env, ctx.sellerId!);
        return [bot.help(`${baseUrl}/seller/login?token=${token}`)];
      }
      return [bot.help(link)];
    }
  }
}

export { ensureSeller };
