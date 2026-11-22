import { newId } from "./lib/id";
import type { Env } from "./types";
import { computeScore, HOT_THRESHOLD, PRICE_RE, type Signals } from "./lib/scoring";
import { telegram } from "./lib/notify";

const DAY = 86400_000;

/** Expire previews whose expires_at passed (live shops are never auto-expired). */
export async function expirePreviews(env: Env, now = new Date()): Promise<number> {
  const r = (await env.DB.prepare("UPDATE shops SET status = 'expired' WHERE status = 'preview' AND expires_at IS NOT NULL AND expires_at < ?").bind(now.toISOString()).run()) as { meta?: { changes?: number } };
  return r.meta?.changes ?? 0;
}

export async function signalsFor(env: Env, shopId: string, leadId: string, now = new Date()): Promise<Signals> {
  const q = async (sql: string, ...b: unknown[]) => ((await env.DB.prepare(sql).bind(...b).first<{ n: number }>())?.n ?? 0);
  const views = await q("SELECT COUNT(*) n FROM preview_events WHERE shop_id = ? AND type = 'view'", shopId);
  const demoPortalViews = await q("SELECT COUNT(*) n FROM preview_events WHERE shop_id = ? AND type = 'demo_portal'", shopId);
  const calls = await q("SELECT COUNT(*) n FROM preview_events WHERE shop_id = ? AND type = 'call_click'", shopId);
  const changes = await q("SELECT COUNT(*) n FROM preview_events WHERE shop_id = ? AND type = 'change'", shopId);
  const inbound = await q("SELECT COUNT(*) n FROM chat_messages WHERE shop_id = ? AND direction = 'in'", shopId);
  const images = await q("SELECT COUNT(*) n FROM chat_messages WHERE shop_id = ? AND direction = 'in' AND kind = 'image'", shopId);
  const callMsgs = await q("SELECT COUNT(*) n FROM chat_messages WHERE shop_id = ? AND direction = 'in' AND kind = 'call_request'", shopId);
  const { results: texts } = await env.DB.prepare("SELECT body FROM chat_messages WHERE shop_id = ? AND direction = 'in' AND kind = 'text' ORDER BY at DESC LIMIT 50").bind(shopId).all<{ body: string }>();
  const { results: days } = await env.DB.prepare("SELECT substr(at,1,10) d FROM preview_events WHERE shop_id = ? UNION SELECT substr(at,1,10) d FROM chat_messages WHERE shop_id = ? AND direction = 'in'").bind(shopId, shopId).all<{ d: string }>();
  const last = await env.DB.prepare("SELECT MAX(at) a FROM (SELECT at FROM preview_events WHERE shop_id = ? UNION ALL SELECT at FROM chat_messages WHERE shop_id = ? AND direction = 'in')").bind(shopId, shopId).first<{ a: string | null }>();
  const optedOut = (await q("SELECT COUNT(*) n FROM consents WHERE lead_id = ? AND revoked_at IS NOT NULL", leadId)) > 0;
  return {
    views,
    inboundMessages: inbound,
    uploadedAssets: images > 0 || changes > 0,
    demoPortalViews,
    askedPrice: texts.some((t) => PRICE_RE.test(t.body)),
    callRequested: calls > 0 || callMsgs > 0,
    activeDays: days.length,
    daysSinceActivity: last?.a ? Math.floor((now.getTime() - new Date(last.a).getTime()) / DAY) : null,
    optedOut,
  };
}

/** Recompute scores; promote to `hot` and alert the founder once. */
export async function scoreLeads(env: Env, now = new Date()): Promise<{ scored: number; hot: number }> {
  const { results } = await env.DB.prepare("SELECT l.id, l.business_name, l.phone, l.area, l.stage, l.shop_id FROM leads l WHERE l.shop_id IS NOT NULL AND l.stage NOT IN ('paid','lost')").all<{ id: string; business_name: string; phone: string | null; area: string | null; stage: string; shop_id: string }>();
  let hot = 0;
  for (const l of results) {
    const sig = await signalsFor(env, l.shop_id, l.id, now);
    const score = computeScore(sig);
    await env.DB.prepare("UPDATE leads SET score = ? WHERE id = ?").bind(score, l.id).run();
    if (score >= HOT_THRESHOLD && l.stage !== "hot") {
      await env.DB.prepare("UPDATE leads SET stage = 'hot' WHERE id = ?").bind(l.id).run();
      const last = await env.DB.prepare("SELECT body FROM chat_messages WHERE shop_id = ? AND direction = 'in' ORDER BY at DESC LIMIT 1").bind(l.shop_id).first<{ body: string }>();
      const reasons = [sig.askedPrice && "asked about price/payment", sig.callRequested && "asked for a call", sig.inboundMessages >= 7 && `${sig.inboundMessages} messages`, sig.views >= 3 && `viewed the site ${sig.views} times`, sig.uploadedAssets && "uploaded photos / made changes"].filter(Boolean).join(", ");
      await telegram(env, `HOT: ${l.business_name} (${l.area ?? ""}) score ${score}. ${reasons}.${last ? ` Last msg: "${last.body.slice(0, 80)}".` : ""} Phone: ${l.phone ?? "-"}`);
      hot++;
    } else if (score < HOT_THRESHOLD - 3 && l.stage === "hot") {
      await env.DB.prepare("UPDATE leads SET stage = 'stalled' WHERE id = ?").bind(l.id).run();
    }
  }
  return { scored: results.length, hot };
}

export async function dailyDigest(env: Env, now = new Date()): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  const q = async (sql: string, ...b: unknown[]) => ((await env.DB.prepare(sql).bind(...b).first<{ n: number }>())?.n ?? 0);
  const newLeads = await q("SELECT COUNT(*) n FROM leads WHERE substr(created_at,1,10) = ?", day);
  const hot = await q("SELECT COUNT(*) n FROM leads WHERE stage = 'hot'");
  const orders = await q("SELECT COUNT(*) n FROM orders WHERE substr(created_at,1,10) = ?", day);
  const expiring = await q("SELECT COUNT(*) n FROM shops WHERE status = 'preview' AND expires_at IS NOT NULL AND expires_at < ?", new Date(now.getTime() + 2 * DAY).toISOString());
  const cost = await q("SELECT COALESCE(SUM(est_cost_paise),0) n FROM bot_usage WHERE day = ?", day);
  await telegram(env, `Daily digest: new leads ${newLeads}, hot leads ${hot}, orders ${orders}, previews expiring in 2 days ${expiring}, bot cost about ₹${(cost / 100).toFixed(2)}.`);
}

/** Unpaid UPI orders hold stock; release it after 48h so nobody can lock a product by placing fake orders. */
export async function releaseStaleOrders(env: Env, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 48 * 3600_000).toISOString();
  const { results } = await env.DB.prepare(
    "SELECT id, shop_id FROM orders WHERE status = 'placed' AND payment_method = 'upi_manual' AND payment_status = 'pending' AND created_at < ? LIMIT 20",
  ).bind(cutoff).all<{ id: string; shop_id: string }>();
  let n = 0;
  for (const o of results) {
    const upd = await env.DB.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ? AND shop_id = ? AND status = 'placed' AND payment_status = 'pending'").bind(o.id, o.shop_id).run();
    if ((upd.meta?.changes ?? 0) === 0) continue;
    const { results: items } = await env.DB.prepare("SELECT product_id, qty FROM order_items WHERE order_id = ? AND shop_id = ?").bind(o.id, o.shop_id).all<{ product_id: string; qty: number }>();
    for (const it of items) await env.DB.prepare("UPDATE products SET stock = stock + ? WHERE id = ? AND shop_id = ?").bind(it.qty, it.product_id, o.shop_id).run();
    await env.DB.prepare("INSERT INTO order_events (id, order_id, shop_id, at, type, detail) VALUES (?,?,?,?,?,?)").bind(newId(), o.id, o.shop_id, now.toISOString(), "cancelled", "auto: unpaid for 48h").run();
    n++;
  }
  return n;
}

export async function runScheduled(env: Env, now = new Date()): Promise<void> {
  await expirePreviews(env, now);
  await releaseStaleOrders(env, now);
  await scoreLeads(env, now);
  // 21:00 IST = 15:30 UTC
  if (now.getUTCHours() === 15) await dailyDigest(env, now);
}
