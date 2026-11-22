import { Hono, type MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import type { AppBindings } from "../types";
import { sameOrigin } from "../middleware/security";
import { signSession, verifySession, timingSafeEqual } from "../lib/auth";
import { secretOf } from "../lib/secret";
import { rateLimit, clientIp } from "../lib/rate";
import { newId } from "../lib/id";
import { parseCsv } from "../lib/csv";
import { buildDemoShop, type LeadRow } from "../lib/demo";
import { createLoginToken, ensureSeller } from "../lib/seller";
import { whatsappTemplate } from "../lib/notify";
import { html, esc, raw, rupees, Raw } from "../lib/html";
import { CSS } from "../views/portal";

export const admin = new Hono<AppBindings>();
admin.use("/admin/*", sameOrigin);

const COOKIE = "vd_admin";
export const STAGES = ["new", "called", "permission", "demo_sent", "editing", "hot", "paid", "stalled", "lost"] as const;
const STAGE_LABEL: Record<string, string> = { new: "New", called: "Called", permission: "Permission", demo_sent: "Demo sent", editing: "Editing", hot: "Hot", paid: "Paid", stalled: "Stalled", lost: "Lost" };
export const OUTREACH_CAP = 30;

function page(title: string, body: Raw | string, flash?: { m?: string; e?: string }): string {
  const nav = ["", "shops", "outreach", "stats", "bot-usage", "audit"].map((p) => `<a href="/admin${p ? "/" + p : ""}">${{ "": "Leads", shops: "Shops", outreach: "Outreach", stats: "Stats", "bot-usage": "Bot cost", audit: "Audit" }[p]}</a>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Vedhin Admin</title><meta name="robots" content="noindex"><style>${CSS}
.nav{display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px;background:#fff;border-bottom:1px solid var(--b)}.nav a{padding:8px 14px;border-radius:99px;text-decoration:none;background:var(--bg);color:var(--t);font-weight:600}
.w{max-width:980px}table{width:100%;border-collapse:collapse}td,th{padding:8px 6px;border-bottom:1px solid var(--b);text-align:left;vertical-align:top;font-size:15px}.inl{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.inl>*{flex:1;min-width:120px}</style></head><body style="padding-bottom:24px">
<div class="top"><b>Vedhin Admin</b><form method="post" action="/admin/logout"><button class="btn s" style="min-height:40px">Logout</button></form></div><div class="nav">${nav}</div>
<div class="w">${flash?.m ? `<div class="msg" role="status">${esc(flash.m)}</div>` : ""}${flash?.e ? `<div class="msg e" role="alert">${esc(flash.e)}</div>` : ""}${body}</div></body></html>`;
}
const fl = (c: { req: { query: (k: string) => string | undefined } }) => ({ m: c.req.query("m"), e: c.req.query("e") });
const go = (path: string, m?: string, e?: string) => `${path}${m ? `?m=${encodeURIComponent(m)}` : e ? `?e=${encodeURIComponent(e)}` : ""}`;

// ---------- login ----------
function loginHtml(error?: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin login</title><meta name="robots" content="noindex"><style>${CSS}</style></head><body><div class="w" style="padding-top:48px"><h1>Vedhin Admin</h1>${error ? `<div class="msg e" role="alert">${esc(error)}</div>` : ""}<form class="card" method="post" action="/admin/login"><label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required><p><button class="btn big">Login</button></p></form></div></body></html>`;
}
admin.get("/admin/login", (c) => c.html(loginHtml()));
admin.post("/admin/login", async (c) => {
  if (!c.env.ADMIN_PASSWORD) return c.html(loginHtml("ADMIN_PASSWORD is not set yet (run: wrangler secret put ADMIN_PASSWORD)."), 503);
  if (!rateLimit(`adminlogin:${clientIp(c.req.raw)}`, 5, 10 * 60_000)) return c.html(loginHtml("Too many attempts. Try again in 10 minutes."), 429);
  const pw = String((await c.req.parseBody()).password ?? "");
  if (!timingSafeEqual(pw, c.env.ADMIN_PASSWORD)) return c.html(loginHtml("Wrong password."), 401);
  const s = await signSession({ role: "admin", id: "founder", exp: Math.floor(Date.now() / 1000) + 7 * 86400 }, secretOf(c.env));
  setCookie(c, COOKIE, s, { httpOnly: true, secure: c.env.APP_ENV === "production", sameSite: "Strict", path: "/", maxAge: 7 * 86400 });
  return c.redirect("/admin");
});
admin.post("/admin/logout", (c) => {
  deleteCookie(c, COOKIE, { path: "/" });
  return c.redirect("/admin/login");
});

const guard: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (c.req.path === "/admin/login" || c.req.path === "/admin/logout") return next();
  const p = await verifySession(getCookie(c, COOKIE), secretOf(c.env));
  if (!p || p.role !== "admin") return c.redirect("/admin/login");
  return next();
};
admin.use("/admin", guard);
admin.use("/admin/*", guard);

async function audit(env: AppBindings["Bindings"], action: string, target: string, meta: object = {}) {
  await env.DB.prepare("INSERT INTO audit_log (id, at, actor, action, target, meta_json) VALUES (?,?,?,?,?,?)").bind(newId(), new Date().toISOString(), "founder", action, target, JSON.stringify(meta)).run();
}
const normPhone = (p: string | undefined | null) => (p ?? "").replace(/\D/g, "").slice(-10);
function normCategory(s: string): string {
  const x = s.toLowerCase();
  if (/jewel|gehn|kundan|bangle|chudi|ornament/.test(x)) return "jewellery";
  if (/dress|kurti|saree|suit|boutique|cloth|garment|lehenga|fashion|textile/.test(x)) return "ladies_dress";
  return "ladies_dress";
}

// ---------- leads board ----------
admin.get("/admin", async (c) => {
  const stage = (STAGES as readonly string[]).includes(c.req.query("stage") ?? "") ? c.req.query("stage")! : "";
  const q = (c.req.query("q") ?? "").trim().slice(0, 40);
  const where: string[] = [];
  const binds: unknown[] = [];
  if (stage) { where.push("stage = ?"); binds.push(stage); }
  if (q) { where.push("(business_name LIKE ? OR phone LIKE ? OR area LIKE ?)"); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const { results: counts } = await c.env.DB.prepare("SELECT stage, COUNT(*) n FROM leads GROUP BY stage").all<{ stage: string; n: number }>();
  const cnt = Object.fromEntries(counts.map((r) => [r.stage, r.n]));
  const { results } = await c.env.DB.prepare(`SELECT id, business_name, phone, area, category, rating, reviews, stage, score, shop_id FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY score DESC, created_at DESC LIMIT 200`).bind(...binds).all<{ id: string; business_name: string; phone: string; area: string; category: string; rating: number; reviews: number; stage: string; score: number; shop_id: string | null }>();
  const body = html`<div class="row"><h1>Leads</h1><div><a class="btn" href="/admin/leads/new">Naya lead</a></div></div>
<div class="sw" style="margin:10px 0"><a class="btn ${stage ? "s" : ""}" style="min-height:40px" href="/admin">Sab</a>${STAGES.map((s) => html`<a class="btn ${stage === s ? "" : "s"}" style="min-height:40px" href="/admin?stage=${s}">${STAGE_LABEL[s]} (${cnt[s] ?? 0})</a>`)}</div>
<form class="inl" method="get" action="/admin"><input name="q" placeholder="Naam / phone / area" value="${q}"><button class="btn s">Dhundein</button></form>
<table><thead><tr><th>Dukaan</th><th>Phone</th><th>Rating</th><th>Stage</th><th>Score</th></tr></thead><tbody>
${results.map((l) => html`<tr><td><a href="/admin/leads/${l.id}"><strong>${l.business_name}</strong></a><div class="muted">${l.area ?? ""} ${l.category ?? ""}</div></td><td>${l.phone ?? ""}</td><td>${l.rating ?? "-"} (${l.reviews ?? 0})</td><td><span class="chip ${l.stage === "hot" ? "r" : l.stage === "paid" ? "g" : ""}">${STAGE_LABEL[l.stage] ?? l.stage}</span></td><td>${l.score}</td></tr>`)}</tbody></table>
${results.length ? "" : html`<div class="card">No leads yet. Add one with "New lead" or import a CSV.</div>`}
<h2>CSV import</h2><form class="card" method="post" action="/admin/leads/import"><p class="muted">First line is the header: business_name, phone, maps_url, instagram_url, category, area, city, rating, reviews, address, source. Duplicates are removed by phone.</p><textarea name="csv" style="min-height:140px" required></textarea><p><button class="btn">Import</button></p></form>`;
  return c.html(page("Leads", body, fl(c)));
});

const leadSchema = z.object({
  business_name: z.string().trim().min(2).max(100),
  phone: z.string().optional().default(""),
  owner_name: z.string().trim().max(80).optional().default(""),
  area: z.string().trim().max(60).optional().default(""),
  city: z.string().trim().max(40).optional().default("Jodhpur"),
  category: z.string().trim().max(40).optional().default(""),
  maps_url: z.string().trim().max(500).optional().default(""),
  instagram_url: z.string().trim().max(300).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  source: z.string().trim().max(20).optional().default("manual"),
  rating: z.coerce.number().min(0).max(5).optional().default(0),
  reviews: z.coerce.number().int().min(0).optional().default(0),
});

async function insertLead(env: AppBindings["Bindings"], d: z.infer<typeof leadSchema>): Promise<"added" | "duplicate" | "invalid"> {
  const phone = normPhone(d.phone);
  if (phone && phone.length !== 10) return "invalid";
  if (phone && (await env.DB.prepare("SELECT 1 x FROM leads WHERE phone = ?").bind(phone).first())) return "duplicate";
  const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : null);
  await env.DB.prepare("INSERT INTO leads (id, created_at, source, business_name, owner_name, phone, city, area, category, maps_url, instagram_url, rating, reviews, address, stage, score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'new', 0)")
    .bind(newId(), new Date().toISOString(), d.source || "manual", d.business_name, d.owner_name || null, phone || null, d.city, d.area, normCategory(d.category || d.business_name), safeUrl(d.maps_url), safeUrl(d.instagram_url), d.rating || null, d.reviews || null, d.address || null).run();
  return "added";
}

admin.get("/admin/leads/new", (c) => {
  const body = html`<h1>Naya lead</h1><form class="card" method="post" action="/admin/leads">
<label for="bn">Dukaan ka naam</label><input id="bn" name="business_name" required maxlength="100">
<label for="ph">Phone (10 digit)</label><input id="ph" name="phone" inputmode="numeric" maxlength="14">
<label for="on">Malik ka naam</label><input id="on" name="owner_name" maxlength="80">
<label for="cat">Category</label><select id="cat" name="category"><option value="ladies_dress">Ladies dress</option><option value="jewellery">Jewellery</option></select>
<label for="ar">Area</label><input id="ar" name="area" maxlength="60"><label for="ci">Shehar</label><input id="ci" name="city" value="Jodhpur">
<label for="mu">Google Maps link</label><input id="mu" name="maps_url" type="url"><label for="iu">Instagram link</label><input id="iu" name="instagram_url" type="url">
<label for="ad">Address</label><textarea id="ad" name="address"></textarea>
<label for="so">Source</label><select id="so" name="source"><option>maps</option><option>instagram</option><option>referral</option><option>manual</option></select>
<p><button class="btn big">Lead jodein</button></p></form>`;
  return c.html(page("Naya lead", body, fl(c)));
});
admin.post("/admin/leads", async (c) => {
  const parsed = leadSchema.safeParse(await c.req.parseBody());
  if (!parsed.success) return c.redirect(go("/admin/leads/new", undefined, "Enter a valid name and phone."));
  const r = await insertLead(c.env, parsed.data);
  if (r === "duplicate") return c.redirect(go("/admin", undefined, "This phone number already exists."));
  if (r === "invalid") return c.redirect(go("/admin/leads/new", undefined, "Phone 10 digit ka hona chahiye."));
  await audit(c.env, "lead_add", parsed.data.business_name);
  return c.redirect(go("/admin", "Lead added."));
});
admin.post("/admin/leads/import", async (c) => {
  const text = String((await c.req.parseBody()).csv ?? "").slice(0, 400_000);
  const rows = parseCsv(text).slice(0, 500);
  let added = 0, dup = 0, bad = 0;
  for (const r of rows) {
    const p = leadSchema.safeParse(r);
    if (!p.success) { bad++; continue; }
    const res = await insertLead(c.env, p.data);
    if (res === "added") added++; else if (res === "duplicate") dup++; else bad++;
  }
  await audit(c.env, "lead_import", "csv", { added, dup, bad });
  return c.redirect(go("/admin", `Import: ${added} naye, ${dup} duplicate, ${bad} galat.`));
});

// ---------- lead detail ----------
async function getLead(env: AppBindings["Bindings"], id: string) {
  return env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first<LeadRow & { stage: string; score: number; notes: string | null; area: string | null; rating: number | null; reviews: number | null }>();
}

admin.get("/admin/leads/:id", async (c) => {
  const l = await getLead(c.env, c.req.param("id"));
  if (!l) return c.redirect(go("/admin", undefined, "Lead not found."));
  const origin = new URL(c.req.url).origin;
  const shop = l.shop_id ? await c.env.DB.prepare("SELECT slug, status, expires_at FROM shops WHERE id = ?").bind(l.shop_id).first<{ slug: string; status: string; expires_at: string | null }>() : null;
  const { results: consents } = await c.env.DB.prepare("SELECT granted_at, channel, granted_by, note, revoked_at FROM consents WHERE lead_id = ? ORDER BY granted_at DESC").bind(l.id).all<{ granted_at: string; channel: string; granted_by: string; note: string | null; revoked_at: string | null }>();
  const { results: chats } = l.shop_id ? await c.env.DB.prepare("SELECT at, direction, body FROM chat_messages WHERE shop_id = ? ORDER BY at DESC LIMIT 15").bind(l.shop_id).all<{ at: string; direction: string; body: string }>() : { results: [] as { at: string; direction: string; body: string }[] };
  const views = l.shop_id ? ((await c.env.DB.prepare("SELECT COUNT(*) n FROM preview_events WHERE shop_id = ? AND type = 'view'").bind(l.shop_id).first<{ n: number }>())?.n ?? 0) : 0;
  const hasConsent = consents.some((x) => !x.revoked_at);
  const body = html`<div class="row"><h1>${l.business_name}</h1><span class="chip ${l.stage === "hot" ? "r" : ""}">${STAGE_LABEL[l.stage] ?? l.stage} | score ${l.score}</span></div>
<div class="card">${l.owner_name ? html`<div>Malik: ${l.owner_name}</div>` : ""}<div>Phone: <a href="tel:${l.phone ?? ""}">${l.phone ?? "-"}</a> | ${l.area ?? ""} | rating ${l.rating ?? "-"} (${l.reviews ?? 0})</div>
<div class="muted">${l.address ?? ""}</div>${l.maps_url ? html`<div><a href="${l.maps_url}" rel="noopener" target="_blank">Google Maps</a></div>` : ""}${l.instagram_url ? html`<div><a href="${l.instagram_url}" rel="noopener" target="_blank">Instagram</a></div>` : ""}</div>
<div class="card"><strong>Demo website</strong>${shop ? html`<p><a href="/s/${shop.slug}" target="_blank">${origin}/s/${shop.slug}</a> (${shop.status}, ${views} views)</p>` : html`<p class="muted">Not built yet.</p><form method="post" action="/admin/leads/${l.id}/build-demo"><button class="btn">Build demo website</button></form>`}</div>
<div class="card"><strong>Permission after the call</strong><form method="post" action="/admin/leads/${l.id}/consent"><div class="inl"><select name="decision"><option value="yes">Yes, WhatsApp is allowed</option><option value="no">No, not interested</option></select><input name="note" placeholder="What the seller said" maxlength="200"><button class="btn">Save</button></div></form>
${consents.map((x) => html`<div class="muted">${x.granted_at.slice(0, 16)} | ${x.channel} | ${x.note ?? ""} ${x.revoked_at ? html`<span class="chip r">revoked</span>` : ""}</div>`)}</div>
<div class="card"><strong>Send WhatsApp</strong><p class="muted">Only after permission, max ${OUTREACH_CAP} per day, with a STOP line.</p><form method="post" action="/admin/leads/${l.id}/send-whatsapp"><button class="btn" ${hasConsent && shop ? "" : "disabled"}>Send preview link</button></form></div>
<div class="card"><strong>Seller login link</strong><p class="muted">Use after the seller pays or to show a demo. Send it on WhatsApp.</p><form method="post" action="/admin/leads/${l.id}/login-link"><button class="btn s" ${shop && l.phone ? "" : "disabled"}>Create new login link</button></form></div>
<div class="card"><strong>Stage aur notes</strong><form method="post" action="/admin/leads/${l.id}/stage"><div class="inl"><select name="stage">${STAGES.map((s) => html`<option value="${s}" ${l.stage === s ? "selected" : ""}>${STAGE_LABEL[s]}</option>`)}</select><button class="btn s">Stage badlein</button></div></form>
<form method="post" action="/admin/leads/${l.id}/note"><textarea name="notes" maxlength="1000">${l.notes ?? ""}</textarea><p><button class="btn s">Notes save</button></p></form></div>
${chats.length ? html`<div class="card"><strong>Chat</strong>${chats.map((m) => html`<div class="muted">${m.at.slice(5, 16)} ${m.direction === "in" ? "Seller" : "Bot"}: ${m.body}</div>`)}</div>` : ""}`;
  return c.html(page(l.business_name, body, fl(c)));
});

admin.post("/admin/leads/:id/stage", async (c) => {
  const s = String((await c.req.parseBody()).stage ?? "");
  if (!(STAGES as readonly string[]).includes(s)) return c.redirect(go(`/admin/leads/${c.req.param("id")}`, undefined, "Invalid stage."));
  await c.env.DB.prepare("UPDATE leads SET stage = ? WHERE id = ?").bind(s, c.req.param("id")).run();
  await audit(c.env, "lead_stage", c.req.param("id"), { stage: s });
  return c.redirect(go(`/admin/leads/${c.req.param("id")}`, "Stage updated."));
});
admin.post("/admin/leads/:id/note", async (c) => {
  await c.env.DB.prepare("UPDATE leads SET notes = ? WHERE id = ?").bind(String((await c.req.parseBody()).notes ?? "").slice(0, 1000), c.req.param("id")).run();
  return c.redirect(go(`/admin/leads/${c.req.param("id")}`, "Notes saved."));
});
admin.post("/admin/leads/:id/build-demo", async (c) => {
  const l = await getLead(c.env, c.req.param("id"));
  if (!l) return c.redirect(go("/admin", undefined, "Lead not found."));
  const r = await buildDemoShop(c.env, l);
  await audit(c.env, "demo_built", l.id, { slug: r.slug });
  return c.redirect(go(`/admin/leads/${l.id}`, "Demo website built."));
});
admin.post("/admin/leads/:id/consent", async (c) => {
  const l = await getLead(c.env, c.req.param("id"));
  if (!l) return c.redirect(go("/admin", undefined, "Lead not found."));
  const form = await c.req.parseBody();
  const note = String(form.note ?? "").slice(0, 200);
  if (form.decision === "yes") {
    if (!l.phone) return c.redirect(go(`/admin/leads/${l.id}`, undefined, "Pehle lead me phone daalein."));
    await c.env.DB.prepare("INSERT INTO consents (id, lead_id, phone, channel, granted_at, granted_by, note) VALUES (?,?,?,?,?,?,?)").bind(newId(), l.id, l.phone, "call", new Date().toISOString(), "founder", note).run();
    if (["new", "called"].includes(l.stage)) await c.env.DB.prepare("UPDATE leads SET stage = 'permission' WHERE id = ?").bind(l.id).run();
  } else {
    await c.env.DB.prepare("UPDATE consents SET revoked_at = ? WHERE lead_id = ? AND revoked_at IS NULL").bind(new Date().toISOString(), l.id).run();
    await c.env.DB.prepare("UPDATE leads SET stage = 'lost', notes = COALESCE(notes,'') || ? WHERE id = ?").bind(`\n[${new Date().toISOString().slice(0, 10)}] ${note}`, l.id).run();
  }
  await audit(c.env, "consent", l.id, { decision: form.decision, note });
  return c.redirect(go(`/admin/leads/${l.id}`, "Permission record saved."));
});

admin.post("/admin/leads/:id/send-whatsapp", async (c) => {
  const l = await getLead(c.env, c.req.param("id"));
  const back = (m?: string, e?: string) => c.redirect(go(`/admin/leads/${c.req.param("id")}`, m, e));
  if (!l || !l.phone) return back(undefined, "No phone number.");
  // Consent is enforced server-side (not only in the UI).
  const consent = await c.env.DB.prepare("SELECT id FROM consents WHERE lead_id = ? AND revoked_at IS NULL").bind(l.id).first();
  if (!consent) return back(undefined, "No permission record. Call the lead and get permission first.");
  if (!l.shop_id) return back(undefined, "Pehle demo website banayein.");
  const today = new Date().toISOString().slice(0, 10);
  const sent = (await c.env.DB.prepare("SELECT COUNT(*) n FROM outreach_queue WHERE substr(created_at,1,10) = ? AND status IN ('sent','queued_stub')").bind(today).first<{ n: number }>())?.n ?? 0;
  if (sent >= OUTREACH_CAP) return back(undefined, `Today's limit (${OUTREACH_CAP}) is reached. Send tomorrow.`);
  const shop = await c.env.DB.prepare("SELECT slug, name FROM shops WHERE id = ?").bind(l.shop_id).first<{ slug: string; name: string }>();
  if (!shop) return back(undefined, "Shop not found.");
  const link = `${new URL(c.req.url).origin}/s/${shop.slug}`;
  const ok = await whatsappTemplate(c.env, "91" + l.phone, c.env.WHATSAPP_TEMPLATE_OPENING ?? "vedhin_preview_link", [l.owner_name || l.business_name, shop.name, link]);
  await c.env.DB.prepare("INSERT INTO outreach_queue (id, lead_id, status, created_at, sent_at) VALUES (?,?,?,?,?)").bind(newId(), l.id, ok ? "sent" : "queued_stub", new Date().toISOString(), ok ? new Date().toISOString() : null).run();
  await c.env.DB.prepare("UPDATE leads SET stage = 'demo_sent' WHERE id = ? AND stage IN ('new','called','permission')").bind(l.id).run();
  await audit(c.env, "whatsapp_outreach", l.id, { sent: ok });
  return back(ok ? "WhatsApp sent." : `WhatsApp is not configured yet. Send this link yourself: ${link}`);
});

admin.post("/admin/leads/:id/login-link", async (c) => {
  const l = await getLead(c.env, c.req.param("id"));
  if (!l || !l.shop_id || !l.phone) return c.redirect(go("/admin", undefined, "Pehle demo aur phone chahiye."));
  const sid = await ensureSeller(c.env, l.shop_id, l.phone, l.owner_name, null);
  const token = await createLoginToken(c.env, sid);
  await audit(c.env, "login_link", l.id);
  const link = `${new URL(c.req.url).origin}/seller/login?token=${token}`;
  return c.html(page("Login link", html`<h1>Seller login link</h1><div class="card"><p>This link works once and lasts 7 days. Send it on WhatsApp:</p><p style="word-break:break-all"><strong>${link}</strong></p></div><p><a class="btn s" href="/admin/leads/${l.id}">Back</a></p>`));
});

// ---------- shops ----------
admin.get("/admin/shops", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, slug, name, status, expires_at, plan, paid_at, (SELECT COUNT(*) FROM orders o WHERE o.shop_id = shops.id) AS orders FROM shops ORDER BY created_at DESC LIMIT 200").all<{ id: string; slug: string; name: string; status: string; expires_at: string | null; plan: string; paid_at: string | null; orders: number }>();
  const body = html`<h1>Shops</h1>${results.length ? "" : html`<div class="card">No shops yet.</div>`}
${results.map((s) => html`<div class="card"><div class="row"><div><strong><a href="/s/${s.slug}" target="_blank">${s.name}</a></strong><div class="muted">${s.slug} | ${s.orders} orders</div></div><span class="chip ${s.status === "live" ? "g" : s.status === "expired" || s.status === "suspended" ? "r" : ""}">${s.status}</span></div>
<form method="post" action="/admin/shops/${s.id}" class="inl" style="margin-top:10px"><div><label>Status</label><select name="status">${["preview", "live", "suspended", "expired"].map((x) => html`<option ${s.status === x ? "selected" : ""}>${x}</option>`)}</select></div>
<div><label>Expiry (empty = never)</label><input type="date" name="expires" value="${s.expires_at?.slice(0, 10) ?? ""}"></div>
<div><label>Plan</label><select name="plan">${["none", "setup", "support"].map((x) => html`<option ${s.plan === x ? "selected" : ""}>${x}</option>`)}</select></div><button class="btn s">Save</button></form>
<form method="post" action="/admin/shops/${s.id}/extend" class="inl" style="margin-top:8px"><button class="btn s" name="days" value="7">+7 days</button><button class="btn s" name="days" value="30">+30 days</button><button class="btn ok" formaction="/admin/shops/${s.id}/paid">Mark as paid (go live)</button></form></div>`)}`;
  return c.html(page("Shops", body, fl(c)));
});
admin.post("/admin/shops/:id", async (c) => {
  const f = await c.req.parseBody();
  const status = String(f.status), plan = String(f.plan);
  const exp = String(f.expires ?? "");
  if (!["preview", "live", "suspended", "expired"].includes(status) || !["none", "setup", "support"].includes(plan)) return c.redirect(go("/admin/shops", undefined, "Invalid value."));
  if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) return c.redirect(go("/admin/shops", undefined, "Invalid date."));
  await c.env.DB.prepare("UPDATE shops SET status = ?, plan = ?, expires_at = ? WHERE id = ?").bind(status, plan, exp ? `${exp}T23:59:59Z` : null, c.req.param("id")).run();
  await audit(c.env, "shop_update", c.req.param("id"), { status, plan, exp });
  return c.redirect(go("/admin/shops", "Shop updated."));
});
admin.post("/admin/shops/:id/extend", async (c) => {
  const days = Number((await c.req.parseBody()).days);
  if (![7, 30].includes(days)) return c.redirect(go("/admin/shops", undefined, "Invalid value."));
  const s = await c.env.DB.prepare("SELECT expires_at FROM shops WHERE id = ?").bind(c.req.param("id")).first<{ expires_at: string | null }>();
  const base = s?.expires_at && new Date(s.expires_at).getTime() > Date.now() ? new Date(s.expires_at).getTime() : Date.now();
  await c.env.DB.prepare("UPDATE shops SET expires_at = ?, status = CASE WHEN status = 'expired' THEN 'preview' ELSE status END WHERE id = ?").bind(new Date(base + days * 86400_000).toISOString(), c.req.param("id")).run();
  await audit(c.env, "shop_extend", c.req.param("id"), { days });
  return c.redirect(go("/admin/shops", `${days} din badh gaye.`));
});
admin.post("/admin/shops/:id/paid", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE shops SET status = 'live', plan = CASE WHEN plan = 'none' THEN 'setup' ELSE plan END, expires_at = NULL, paid_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  await c.env.DB.prepare("UPDATE leads SET stage = 'paid' WHERE shop_id = ?").bind(id).run();
  await audit(c.env, "shop_paid", id);
  return c.redirect(go("/admin/shops", "Shop is live. Send the seller a login link."));
});

// ---------- outreach, stats, bot cost, audit ----------
admin.get("/admin/outreach", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT q.status, q.created_at, l.business_name, l.id lid FROM outreach_queue q JOIN leads l ON l.id = q.lead_id ORDER BY q.created_at DESC LIMIT 100").all<{ status: string; created_at: string; business_name: string; lid: string }>();
  const today = new Date().toISOString().slice(0, 10);
  const n = results.filter((r) => r.created_at.startsWith(today)).length;
  return c.html(page("Outreach", html`<h1>Outreach</h1><div class="card">Aaj: <strong>${n}</strong> / ${OUTREACH_CAP}</div><table><tbody>${results.map((r) => html`<tr><td><a href="/admin/leads/${r.lid}">${r.business_name}</a></td><td>${r.created_at.slice(0, 16)}</td><td>${r.status}</td></tr>`)}</tbody></table>`));
});

admin.get("/admin/stats", async (c) => {
  const one = async (sql: string) => ((await c.env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0);
  const [leads, called, perm, demos, hot, paid, support, optouts] = await Promise.all([
    one("SELECT COUNT(*) n FROM leads"), one("SELECT COUNT(*) n FROM leads WHERE stage != 'new'"),
    one("SELECT COUNT(DISTINCT lead_id) n FROM consents"), one("SELECT COUNT(*) n FROM leads WHERE shop_id IS NOT NULL"),
    one("SELECT COUNT(*) n FROM leads WHERE stage = 'hot'"), one("SELECT COUNT(*) n FROM shops WHERE paid_at IS NOT NULL"),
    one("SELECT COUNT(*) n FROM shops WHERE plan = 'support'"), one("SELECT COUNT(*) n FROM consents WHERE revoked_at IS NOT NULL"),
  ]);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + "%" : "-");
  const body = html`<h1>Stats</h1><div class="stats"><div class="card"><strong>${leads}</strong>Total leads</div><div class="card"><strong>${called}</strong>Contacted</div><div class="card"><strong>${perm}</strong>Permission given (${pct(perm, called)})</div><div class="card"><strong>${demos}</strong>Demos built</div><div class="card"><strong>${hot}</strong>Hot now</div><div class="card"><strong>${paid}</strong>Paid (${pct(paid, demos)} of demos)</div></div>
<div class="card"><div>Setup se kamai: <strong>${rupees(paid * 1999)}</strong></div><div>Monthly recurring: <strong>${rupees(support * 499)}</strong> (${support} support plans)</div><div class="muted">Opt-out / permission wapas: ${optouts}</div></div>`;
  return c.html(page("Stats", body));
});

admin.get("/admin/bot-usage", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT s.name, SUM(b.ai_calls) calls, SUM(b.input_tokens) tin, SUM(b.output_tokens) tout, SUM(b.est_cost_paise) cost FROM bot_usage b JOIN shops s ON s.id = b.shop_id WHERE b.day >= date('now','-30 day') GROUP BY b.shop_id ORDER BY calls DESC").all<{ name: string; calls: number; tin: number; tout: number; cost: number }>();
  return c.html(page("Bot cost", html`<h1>Bot cost (30 days)</h1><table><thead><tr><th>Shop</th><th>AI calls</th><th>Tokens in/out</th><th>Cost (approx)</th></tr></thead><tbody>${results.map((r) => html`<tr><td>${r.name}</td><td>${r.calls}</td><td>${r.tin}/${r.tout}</td><td>₹${(r.cost / 100).toFixed(2)}</td></tr>`)}</tbody></table>${results.length ? "" : html`<div class="card">No AI usage yet.</div>`}`));
});

admin.get("/admin/audit", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT at, action, target, meta_json FROM audit_log ORDER BY at DESC LIMIT 100").all<{ at: string; action: string; target: string; meta_json: string }>();
  return c.html(page("Audit", html`<h1>Audit log</h1><table><tbody>${results.map((r) => html`<tr><td>${r.at.slice(0, 19)}</td><td>${r.action}</td><td>${r.target}</td><td class="muted">${r.meta_json}</td></tr>`)}</tbody></table>`));
});

void raw;
