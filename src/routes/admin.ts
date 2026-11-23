import { botChatLink } from "../lib/wa";
import { Hono, type MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import type { AppBindings } from "../types";
import { sameOrigin } from "../middleware/security";
import { signSession, verifySession, timingSafeEqual } from "../lib/auth";
import { secretOf, isDeployed } from "../lib/secret";
import { rateLimit, dbRateLimit, clientIp } from "../lib/rate";
import { verifyTotp, newTotpSecret } from "../lib/totp";
import { newId } from "../lib/id";
import { parseCsv } from "../lib/csv";
import { buildDemoShop, type LeadRow } from "../lib/demo";
import { createLoginToken, ensureSeller } from "../lib/seller";
import { whatsappTemplate } from "../lib/notify";
import { html, esc, raw, rupees, Raw } from "../lib/html";
import { adminPage, authPage, head as pageHead, kpi, empty, icon, stageBadge, statusBadge, STAGE_COLOR, STAGE_LABEL, fmt, fmtDate, istDayStartIso } from "../views/admin";

export const admin = new Hono<AppBindings>();
admin.use("/admin/*", sameOrigin);

const COOKIE = "vd_admin";
export const STAGES = ["new", "called", "permission", "demo_sent", "editing", "hot", "paid", "stalled", "lost"] as const;
export const DEFAULT_OUTREACH_CAP = 30;
export const outreachCap = (env: { OUTREACH_CAP?: string }) => Math.max(1, Math.min(100, Number(env.OUTREACH_CAP) || DEFAULT_OUTREACH_CAP));

const page = adminPage;
const fl = (c: { req: { query: (k: string) => string | undefined } }) => ({ m: c.req.query("m"), e: c.req.query("e") });
const go = (path: string, m?: string, e?: string) => `${path}${m ? `?m=${encodeURIComponent(m)}` : e ? `?e=${encodeURIComponent(e)}` : ""}`;
const one = async (env: AppBindings["Bindings"], sql: string, ...b: unknown[]) => ((await env.DB.prepare(sql).bind(...b).first<{ n: number }>())?.n ?? 0);

// ---------- login (password + authenticator code) ----------
function loginHtml(error?: string, needCode = true) {
  return authPage("Log in", html`<div class="panel"><div class="panel-b"><h1 style="font-size:22px;margin-bottom:4px">Welcome back</h1><p class="muted" style="margin:0 0 20px">Log in to manage leads, shops and outreach.</p>
${error ? html`<div class="toast e" role="alert">${error}</div>` : ""}
<form method="post" action="/admin/login"><div class="field"><label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required autofocus></div>
${needCode ? html`<div class="field"><label for="code">Authenticator code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6-digit code"><p class="hint">Open Google Authenticator and enter the current code.</p></div>` : ""}
<button class="btn" style="width:100%;min-height:44px">Log in</button></form></div></div>`);
}
function setupHtml(secret: string) {
  return authPage("Set up 2-step login", html`<div class="panel"><div class="panel-b"><h1 style="font-size:22px;margin-bottom:8px">Set up 2-step login</h1>
<p class="muted" style="margin:0 0 16px">Your password is correct, but 2-step login is not switched on yet. Do this once:</p>
<ol style="padding-left:20px;margin:0 0 16px;display:grid;gap:10px"><li>Open Google Authenticator (or Authy) and add an account with <b>Enter a setup key</b>.</li>
<li>Use this setup key:<div style="margin-top:6px;padding:12px;border:1px dashed var(--line);border-radius:9px;background:#FAFBFC;font-weight:700;font-size:18px;letter-spacing:.12em;word-break:break-all">${secret}</div></li>
<li>In Cloudflare, open this Worker, then <b>Settings</b>, <b>Variables and Secrets</b>. Add a secret named <code>ADMIN_TOTP_SECRET</code> with the same key. Save and deploy.</li>
<li>Come back and log in with your password and the 6-digit code.</li></ol>
<p class="hint">This key is shown only on this page. Refreshing creates a new one.</p></div></div>`);
}
admin.get("/admin/login", (c) => c.html(loginHtml(undefined, !!c.env.ADMIN_TOTP_SECRET)));
admin.post("/admin/login", async (c) => {
  if (!c.env.ADMIN_PASSWORD) return c.html(loginHtml("ADMIN_PASSWORD is not set yet. Add it under Settings, Variables and Secrets.", false), 503);
  // Durable limiter (shared across all Worker instances): 8 attempts per 15 minutes per IP, and 20 per hour overall.
  const ip = clientIp(c.req.raw);
  if (!(await dbRateLimit(c.env.DB, `adminlogin:${ip}`, 8, 15 * 60_000)) || !(await dbRateLimit(c.env.DB, "adminlogin:all", 20, 60 * 60_000)))
    return c.html(loginHtml("Too many attempts. Try again later.", !!c.env.ADMIN_TOTP_SECRET), 429);
  const form = await c.req.parseBody();
  const pw = String(form.password ?? "");
  if (!timingSafeEqual(pw, c.env.ADMIN_PASSWORD)) return c.html(loginHtml("Wrong password or code.", !!c.env.ADMIN_TOTP_SECRET), 401);
  if (!c.env.ADMIN_TOTP_SECRET) {
    // Production refuses to open the panel without 2-step login; show a one-time setup key instead of a session.
    if (isDeployed(c.env)) return c.html(setupHtml(newTotpSecret()));
  } else if (!(await verifyTotp(c.env.ADMIN_TOTP_SECRET, String(form.code ?? "").trim()))) {
    return c.html(loginHtml("Wrong password or code.", true), 401);
  }
  const s = await signSession({ role: "admin", id: "founder", exp: Math.floor(Date.now() / 1000) + 7 * 86400 }, secretOf(c.env));
  setCookie(c, COOKIE, s, { httpOnly: true, secure: isDeployed(c.env), sameSite: "Strict", path: "/", maxAge: 7 * 86400 });
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
const catLabel = (c: string | null | undefined) => (c === "jewellery" ? "Jewellery" : c === "ladies_dress" ? "Ladies dress" : c ?? "");
const ACTION_LABEL: Record<string, string> = { lead_add: "Added a lead", lead_import: "Imported leads", lead_stage: "Changed lead stage", demo_built: "Built a demo website", consent: "Recorded call permission", whatsapp_outreach: "Sent WhatsApp preview link", login_link: "Created a seller login link", shop_update: "Updated a shop", shop_extend: "Extended a preview", shop_paid: "Marked a shop as paid", backup_download: "Downloaded a backup" };

// ---------- overview ----------
admin.get("/admin", async (c) => {
  const db = c.env.DB;
  const now = new Date();
  const dayStart = istDayStartIso(now);
  const { results: counts } = await db.prepare("SELECT stage, COUNT(*) n FROM leads GROUP BY stage").all<{ stage: string; n: number }>();
  const cnt: Record<string, number> = Object.fromEntries(counts.map((r) => [r.stage, r.n]));
  const total = counts.reduce((a, r) => a + r.n, 0);
  const [live, paidShops, support, demos, sentToday, orders7] = await Promise.all([
    one(c.env, "SELECT COUNT(*) n FROM shops WHERE status = 'live'"),
    one(c.env, "SELECT COUNT(*) n FROM shops WHERE paid_at IS NOT NULL"),
    one(c.env, "SELECT COUNT(*) n FROM shops WHERE plan = 'support'"),
    one(c.env, "SELECT COUNT(*) n FROM shops"),
    one(c.env, "SELECT COUNT(*) n FROM outreach_queue WHERE created_at >= ? AND status IN ('sent','queued_stub')", dayStart),
    one(c.env, "SELECT COUNT(*) n FROM orders WHERE created_at >= ?", new Date(now.getTime() - 7 * 86400_000).toISOString()),
  ]);
  const { results: hot } = await db.prepare("SELECT id, business_name, phone, area, score FROM leads WHERE stage = 'hot' ORDER BY score DESC, created_at DESC LIMIT 5").all<{ id: string; business_name: string; phone: string | null; area: string | null; score: number }>();
  const { results: expiring } = await db.prepare("SELECT s.name, s.slug, s.expires_at, l.id lid FROM shops s LEFT JOIN leads l ON l.shop_id = s.id WHERE s.status = 'preview' AND s.expires_at IS NOT NULL AND s.expires_at < ? ORDER BY s.expires_at LIMIT 5").bind(new Date(now.getTime() + 7 * 86400_000).toISOString()).all<{ name: string; slug: string; expires_at: string; lid: string | null }>();
  const { results: recent } = await db.prepare("SELECT at, action, target FROM audit_log ORDER BY at DESC LIMIT 6").all<{ at: string; action: string; target: string }>();
  const cap = outreachCap(c.env);
  const revenue = paidShops * 1999 + support * 499;
  const date = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });
  const funnel = STAGES.filter((s) => cnt[s]).map((s) => html`<i style="flex:${cnt[s]};background:${STAGE_COLOR[s]}" title="${STAGE_LABEL[s]}: ${cnt[s]}"></i>`);
  const body = html`${pageHead("Overview", date, html`<a class="btn s" href="/admin/leads/import">${icon("upload", 16)}Import CSV</a><a class="btn" href="/admin/leads/new">${icon("plus", 16)}Add lead</a>`)}
<div class="kpis">${kpi("Total leads", total, `${demos} with a demo website`)}${kpi("Hot leads", cnt.hot ?? 0, (cnt.hot ?? 0) ? "Call these first" : "Score 7 or more becomes hot", "hot")}${kpi("Live shops", live, `${paidShops} paid so far`)}${kpi("Monthly value", rupees(revenue), `${rupees(paidShops * 1999)} setup + ${rupees(support * 499)}/month`)}</div>
<div class="stack">
<div class="panel"><div class="panel-h"><h2>Pipeline</h2><a class="sm" href="/admin/leads">View all leads</a></div><div class="panel-b">
${total ? html`<div class="funnel" role="img" aria-label="Leads by stage">${funnel}</div><div class="legend">${STAGES.map((s) => html`<a href="/admin/leads?stage=${s}"><i style="--c:${STAGE_COLOR[s]}"></i>${STAGE_LABEL[s]}<b>${cnt[s] ?? 0}</b></a>`)}</div>` : empty("No leads yet", "Add your first lead or import a CSV to start the pipeline.", html`<a class="btn" href="/admin/leads/new">${icon("plus", 16)}Add lead</a>`)}</div></div>
<div class="cols">
<div class="panel"><div class="panel-h"><h2>Hot leads</h2><span class="muted sm">Call these first</span></div>
${hot.length ? html`<ul class="list">${hot.map((l) => html`<li><div class="g"><b><a href="/admin/leads/${l.id}">${l.business_name}</a></b><span>${[l.area, l.phone].filter(Boolean).join("  |  ")}</span></div><span class="badge" style="--c:#E0661A">Score ${l.score}</span></li>`)}</ul>` : empty("No hot leads right now", "A lead turns hot when the seller opens the preview, chats and asks about price.")}</div>
<div class="stack">
<div class="panel"><div class="panel-h"><h2>Today's outreach</h2><a class="sm" href="/admin/outreach">Details</a></div><div class="panel-b"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:26px;font-weight:650">${sentToday}<span class="muted" style="font-size:15px;font-weight:500"> / ${cap}</span></span><span class="muted sm">WhatsApp messages</span></div><div class="prog"><i style="width:${Math.min(100, Math.round((sentToday / cap) * 100))}%"></i></div><p class="hint">Resets at midnight IST. ${orders7} order${orders7 === 1 ? "" : "s"} across all shops in the last 7 days.</p></div></div>
<div class="panel"><div class="panel-h"><h2>Previews ending soon</h2></div>${expiring.length ? html`<ul class="list">${expiring.map((s) => html`<li><div class="g"><b>${s.name}</b><span>Ends ${fmtDate(s.expires_at)}</span></div>${s.lid ? html`<a class="btn s sm" href="/admin/leads/${s.lid}">Open</a>` : ""}</li>`)}</ul>` : html`<div class="empty" style="padding:22px">Nothing expires in the next 7 days.</div>`}</div>
</div></div>
<div class="panel"><div class="panel-h"><h2>Recent activity</h2><a class="sm" href="/admin/audit">Audit log</a></div>${recent.length ? html`<ul class="list">${recent.map((r) => html`<li><div class="g"><b>${ACTION_LABEL[r.action] ?? r.action}</b></div><span class="muted sm">${fmt(r.at)}</span></li>`)}</ul>` : html`<div class="empty" style="padding:22px">Actions you take will show up here.</div>`}</div>
</div>`;
  return c.html(page("Overview", "overview", body, fl(c)));
});

// ---------- leads ----------
type LeadListRow = { id: string; business_name: string; phone: string; area: string; category: string; rating: number; reviews: number; stage: string; score: number };
admin.get("/admin/leads", async (c) => {
  const stage = (STAGES as readonly string[]).includes(c.req.query("stage") ?? "") ? c.req.query("stage")! : "";
  const q = (c.req.query("q") ?? "").trim().slice(0, 40);
  const where: string[] = [];
  const binds: unknown[] = [];
  if (stage) { where.push("stage = ?"); binds.push(stage); }
  if (q) { where.push("(business_name LIKE ? OR phone LIKE ? OR area LIKE ?)"); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const { results: counts } = await c.env.DB.prepare("SELECT stage, COUNT(*) n FROM leads GROUP BY stage").all<{ stage: string; n: number }>();
  const cnt = Object.fromEntries(counts.map((r) => [r.stage, r.n])) as Record<string, number>;
  const total = counts.reduce((a, r) => a + r.n, 0);
  const { results } = await c.env.DB.prepare(`SELECT id, business_name, phone, area, category, rating, reviews, stage, score FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY score DESC, created_at DESC LIMIT 200`).bind(...binds).all<LeadListRow>();
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  const tab = (key: string, label: string, n: number) => html`<a href="/admin/leads${key ? `?stage=${key}${qs}` : q ? `?q=${encodeURIComponent(q)}` : ""}" ${stage === key ? raw('aria-current="page"') : ""}>${label}<span>${n}</span></a>`;
  const body = html`${pageHead("Leads", `${total} in total`, html`<a class="btn s" href="/admin/leads/import">${icon("upload", 16)}Import CSV</a><a class="btn" href="/admin/leads/new">${icon("plus", 16)}Add lead</a>`)}
<div class="ut" role="navigation" aria-label="Stage">${tab("", "All", total)}${STAGES.map((s) => tab(s, STAGE_LABEL[s]!, cnt[s] ?? 0))}</div>
<form class="tool" method="get" action="/admin/leads">${stage ? html`<input type="hidden" name="stage" value="${stage}">` : ""}<div class="search">${icon("search", 16)}<input name="q" placeholder="Search by name, phone or area" value="${q}" aria-label="Search leads"></div><button class="btn s">Search</button>${q ? html`<a class="sm" href="/admin/leads${stage ? `?stage=${stage}` : ""}">Clear</a>` : ""}</form>
<div class="panel" style="overflow-x:auto">${results.length ? html`<table class="tbl"><thead><tr><th>Business</th><th class="hide-s">Phone</th><th class="hide-s">Rating</th><th>Stage</th><th class="hide-s">Score</th><th class="hide-s"></th></tr></thead><tbody>
${results.map((l) => html`<tr><td><a class="who" href="/admin/leads/${l.id}">${l.business_name}</a><div class="muted sm">${[l.area, catLabel(l.category)].filter(Boolean).join("  |  ")}</div></td><td class="hide-s">${l.phone ?? "-"}</td><td class="hide-s">${l.rating ? `${l.rating} (${l.reviews ?? 0})` : "-"}</td><td>${stageBadge(l.stage)}</td><td class="hide-s"><div class="score"><em>${l.score}</em><i style="width:${Math.min(60, l.score * 6)}px"></i></div></td><td class="r hide-s"><a href="/admin/leads/${l.id}" aria-label="Open ${l.business_name}">${icon("arrow", 16)}</a></td></tr>`)}</tbody></table>`
    : empty(q || stage ? "No leads match" : "No leads yet", q || stage ? "Try a different search or stage." : "Add a lead by hand or import a CSV from Google Maps.", q || stage ? "" : html`<a class="btn" href="/admin/leads/new">${icon("plus", 16)}Add lead</a>`)}</div>`;
  return c.html(page("Leads", "leads", body, fl(c)));
});

admin.get("/admin/leads/import", (c) => {
  const body = html`${pageHead("Import leads", "Paste a CSV. Duplicates are skipped by phone number.")}
<form class="panel" method="post" action="/admin/leads/import"><div class="panel-b"><div class="field"><label for="csv">CSV data</label><textarea id="csv" name="csv" style="min-height:220px;font-family:ui-monospace,Menlo,monospace;font-size:13px" required placeholder="business_name,phone,category,area&#10;Sona Kundan Jewellers,9822222222,jewellery,Sardarpura"></textarea><p class="hint">First line is the header. Columns: business_name, phone, maps_url, instagram_url, category, area, city, rating, reviews, address, source. Up to 500 rows.</p></div><button class="btn">Import leads</button> <a class="btn s" href="/admin/leads">Cancel</a></div></form>`;
  return c.html(page("Import leads", "leads", body, fl(c)));
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
  const body = html`${pageHead("Add lead", "Add a shop you found on Google Maps, Instagram or by referral.")}
<form class="panel" method="post" action="/admin/leads"><div class="panel-b">
<div class="fgrid"><div class="field"><label for="bn">Shop name</label><input id="bn" name="business_name" required maxlength="100"></div>
<div class="field"><label for="ph">Phone (10 digits)</label><input id="ph" name="phone" inputmode="numeric" maxlength="14"></div>
<div class="field"><label for="on">Owner name</label><input id="on" name="owner_name" maxlength="80"></div>
<div class="field"><label for="cat">Category</label><select id="cat" name="category"><option value="ladies_dress">Ladies dress</option><option value="jewellery">Jewellery</option></select></div>
<div class="field"><label for="ar">Area</label><input id="ar" name="area" maxlength="60"></div>
<div class="field"><label for="ci">City</label><input id="ci" name="city" value="Jodhpur"></div>
<div class="field"><label for="mu">Google Maps link</label><input id="mu" name="maps_url" type="url"></div>
<div class="field"><label for="iu">Instagram link</label><input id="iu" name="instagram_url" type="url"></div></div>
<div class="field"><label for="ad">Address</label><textarea id="ad" name="address" style="min-height:70px"></textarea></div>
<div class="field" style="max-width:280px"><label for="so">Source</label><select id="so" name="source"><option value="maps">Google Maps</option><option value="instagram">Instagram</option><option value="referral">Referral</option><option value="manual">Manual</option></select></div>
<button class="btn">Add lead</button> <a class="btn s" href="/admin/leads">Cancel</a></div></form>`;
  return c.html(page("Add lead", "leads", body, fl(c)));
});
admin.post("/admin/leads", async (c) => {
  const parsed = leadSchema.safeParse(await c.req.parseBody());
  if (!parsed.success) return c.redirect(go("/admin/leads/new", undefined, "Enter a valid shop name and phone number."));
  const r = await insertLead(c.env, parsed.data);
  if (r === "duplicate") return c.redirect(go("/admin/leads", undefined, "This phone number already exists."));
  if (r === "invalid") return c.redirect(go("/admin/leads/new", undefined, "Phone number must be 10 digits."));
  await audit(c.env, "lead_add", parsed.data.business_name);
  return c.redirect(go("/admin/leads", "Lead added."));
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
  return c.redirect(go("/admin/leads", `Import finished: ${added} added, ${dup} duplicates skipped, ${bad} rows invalid.`));
});

// ---------- lead detail ----------
async function getLead(env: AppBindings["Bindings"], id: string) {
  return env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first<LeadRow & { stage: string; score: number; notes: string | null; area: string | null; city: string | null; rating: number | null; reviews: number | null }>();
}

admin.get("/admin/leads/:id", async (c) => {
  const l = await getLead(c.env, c.req.param("id"));
  if (!l) return c.redirect(go("/admin/leads", undefined, "Lead not found."));
  const origin = new URL(c.req.url).origin;
  const shop = l.shop_id ? await c.env.DB.prepare("SELECT slug, status, expires_at FROM shops WHERE id = ?").bind(l.shop_id).first<{ slug: string; status: string; expires_at: string | null }>() : null;
  const { results: consents } = await c.env.DB.prepare("SELECT granted_at, channel, granted_by, note, revoked_at FROM consents WHERE lead_id = ? ORDER BY granted_at DESC").bind(l.id).all<{ granted_at: string; channel: string; granted_by: string; note: string | null; revoked_at: string | null }>();
  const { results: chats } = l.shop_id ? await c.env.DB.prepare("SELECT at, direction, body FROM chat_messages WHERE shop_id = ? ORDER BY at DESC LIMIT 15").bind(l.shop_id).all<{ at: string; direction: string; body: string }>() : { results: [] as { at: string; direction: string; body: string }[] };
  const views = l.shop_id ? await one(c.env, "SELECT COUNT(*) n FROM preview_events WHERE shop_id = ? AND type = 'view'", l.shop_id) : 0;
  const hasConsent = consents.some((x) => !x.revoked_at);
  const botLink = botChatLink(c.env, "Hi");
  const body = html`${pageHead(l.business_name, [l.area, catLabel(l.category), l.city].filter(Boolean).join("  |  "), html`${stageBadge(l.stage)}<span class="badge" style="--c:#E0661A">Score ${l.score}</span>${l.phone ? html`<a class="btn s" href="tel:${l.phone}">Call ${l.phone}</a>` : ""}`)}
<p style="margin:-10px 0 18px"><a class="sm" href="/admin/leads">Back to leads</a></p>
<div class="cols"><div class="stack">
<div class="panel"><div class="panel-h"><h2>Shop details</h2></div><div class="panel-b"><dl class="dl">
<dt>Owner</dt><dd>${l.owner_name ?? "-"}</dd><dt>Phone</dt><dd>${l.phone ?? "-"}</dd><dt>Rating</dt><dd>${l.rating ? `${l.rating} (${l.reviews ?? 0} reviews)` : "-"}</dd><dt>Address</dt><dd>${l.address ?? "-"}</dd>
<dt>Links</dt><dd>${l.maps_url ? html`<a href="${l.maps_url}" rel="noopener" target="_blank">Google Maps</a>` : ""}${l.maps_url && l.instagram_url ? "  |  " : ""}${l.instagram_url ? html`<a href="${l.instagram_url}" rel="noopener" target="_blank">Instagram</a>` : ""}${!l.maps_url && !l.instagram_url ? "-" : ""}</dd></dl></div></div>
<div class="panel"><div class="panel-h"><h2>Demo website</h2>${shop ? statusBadge(shop.status) : ""}</div><div class="panel-b">${shop ? html`<label class="sm muted" for="plink" style="display:block;margin-bottom:6px">Preview link (the same link the seller gets)</label><input id="plink" readonly value="${origin}/s/${shop.slug}" onclick="this.select()" style="width:100%;min-height:40px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:#FAFBFC;font:600 13px Inter,sans-serif"><div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 12px"><a class="btn sm" href="/s/${shop.slug}" target="_blank" rel="noopener">${icon("external", 14)}Open preview</a><button type="button" class="btn s sm" onclick="var i=document.getElementById('plink');navigator.clipboard.writeText(i.value).then(function(){this.textContent='Copied'}.bind(this),function(){i.select()})">Copy link</button></div><p class="muted sm" style="margin:0">${views} preview view${views === 1 ? "" : "s"}${shop.expires_at ? ` | Ends ${fmtDate(shop.expires_at)}` : " | No expiry"}</p>` : html`<p class="muted" style="margin:0 0 14px">No demo website yet. Build one to share a live preview with this seller.</p><form method="post" action="/admin/leads/${l.id}/build-demo"><button class="btn">Build demo website</button></form>`}</div></div>
<div class="panel"><div class="panel-h"><h2>Seller chat</h2></div><div class="panel-b">${chats.length ? html`<div class="chat">${[...chats].reverse().map((m) => html`<div class="${m.direction === "in" ? "" : "out"}"><span class="muted sm">${fmt(m.at)} | ${m.direction === "in" ? "Seller" : "Bot"}</span><br>${m.body}</div>`)}</div>` : html`<p class="muted" style="margin:0">No messages yet.</p>`}</div></div>
</div><div class="stack">
<div class="panel"><div class="panel-h"><h2>1. Call permission</h2>${hasConsent ? html`<span class="badge" style="--c:#167C4A">Allowed</span>` : ""}</div><div class="panel-b"><form method="post" action="/admin/leads/${l.id}/consent"><div class="field"><label for="dec">Outcome of your call</label><select id="dec" name="decision"><option value="yes">Yes, WhatsApp is allowed</option><option value="no">No, not interested</option></select></div><div class="field"><label for="nt">What the seller said</label><input id="nt" name="note" maxlength="200"></div><button class="btn s">Save permission</button></form>
${consents.length ? html`<ul class="list" style="margin:14px -18px -18px;border-top:1px solid var(--line2)">${consents.map((x) => html`<li><div class="g"><b>${x.channel === "call" ? "Call" : x.channel}</b><span>${fmt(x.granted_at)}${x.note ? ` | ${x.note}` : ""}</span></div>${x.revoked_at ? html`<span class="badge" style="--c:#B42318">Revoked</span>` : ""}</li>`)}</ul>` : ""}</div></div>
<div class="panel"><div class="panel-h"><h2>Bot chat link</h2></div><div class="panel-b">${botLink ? html`<p class="muted sm" style="margin:0 0 10px">Send this from your own WhatsApp. The seller taps it, sends "Hi", and the assistant replies. Free.</p><input id="blink" readonly value="${botLink}" onclick="this.select()" style="width:100%;min-height:40px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:#FAFBFC;font:600 13px Inter,sans-serif"><div style="margin-top:10px"><button type="button" class="btn s sm" onclick="var i=document.getElementById('blink');navigator.clipboard.writeText(i.value).then(function(){this.textContent='Copied'}.bind(this),function(){i.select()})">Copy link</button></div>` : html`<p class="muted sm" style="margin:0">Not set up yet. Add the <b>WHATSAPP_BOT_NUMBER</b> variable (digits with country code) to turn this on.</p>`}</div></div>
<div class="panel"><div class="panel-h"><h2>2. Send preview link</h2></div><div class="panel-b"><p class="muted" style="margin:0 0 12px">Only after permission. Max ${outreachCap(c.env)} per day, with a STOP line.</p><form method="post" action="/admin/leads/${l.id}/send-whatsapp"><button class="btn" ${hasConsent && shop ? "" : "disabled"}>Send on WhatsApp</button></form>${hasConsent && shop ? "" : html`<p class="hint">${!hasConsent ? "Record call permission first." : "Build the demo website first."}</p>`}</div></div>
<div class="panel"><div class="panel-h"><h2>3. Seller login link</h2></div><div class="panel-b"><p class="muted" style="margin:0 0 12px">Create a one-time link so the seller can open their portal.</p><form method="post" action="/admin/leads/${l.id}/login-link"><button class="btn s" ${shop && l.phone ? "" : "disabled"}>Create login link</button></form></div></div>
<div class="panel"><div class="panel-h"><h2>Stage and notes</h2></div><div class="panel-b"><form method="post" action="/admin/leads/${l.id}/stage"><div class="inl"><div><label for="st">Stage</label><select id="st" name="stage">${STAGES.map((s) => html`<option value="${s}" ${l.stage === s ? "selected" : ""}>${STAGE_LABEL[s]}</option>`)}</select></div><button class="btn s">Update</button></div></form>
<form method="post" action="/admin/leads/${l.id}/note" style="margin-top:16px"><div class="field"><label for="nts">Notes</label><textarea id="nts" name="notes" maxlength="1000">${l.notes ?? ""}</textarea></div><button class="btn s">Save notes</button></form></div></div>
</div></div>`;
  return c.html(page(l.business_name, "leads", body, fl(c)));
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
  if (!l) return c.redirect(go("/admin/leads", undefined, "Lead not found."));
  const r = await buildDemoShop(c.env, l);
  await audit(c.env, "demo_built", l.id, { slug: r.slug });
  return c.redirect(go(`/admin/leads/${l.id}`, "Demo website built."));
});
admin.post("/admin/leads/:id/consent", async (c) => {
  const l = await getLead(c.env, c.req.param("id"));
  if (!l) return c.redirect(go("/admin/leads", undefined, "Lead not found."));
  const form = await c.req.parseBody();
  const note = String(form.note ?? "").slice(0, 200);
  if (form.decision === "yes") {
    if (!l.phone) return c.redirect(go(`/admin/leads/${l.id}`, undefined, "Add a phone number to this lead first."));
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
  if (!l.shop_id) return back(undefined, "Build the demo website first.");
  const sent = await one(c.env, "SELECT COUNT(*) n FROM outreach_queue WHERE created_at >= ? AND status IN ('sent','queued_stub')", istDayStartIso());
  const cap = outreachCap(c.env);
  if (sent >= cap) return back(undefined, `Today's limit (${cap}) is reached. Send tomorrow.`);
  const shop = await c.env.DB.prepare("SELECT slug, name FROM shops WHERE id = ?").bind(l.shop_id).first<{ slug: string; name: string }>();
  if (!shop) return back(undefined, "Shop not found.");
  const link = `${new URL(c.req.url).origin}/s/${shop.slug}`;
  const ok = await whatsappTemplate(c.env, "91" + l.phone, c.env.WHATSAPP_TEMPLATE_OPENING ?? "vedhin_preview_link", [l.owner_name || l.business_name, shop.name, link]);
  await c.env.DB.prepare("INSERT INTO outreach_queue (id, lead_id, status, created_at, sent_at) VALUES (?,?,?,?,?)").bind(newId(), l.id, ok ? "sent" : "queued_stub", new Date().toISOString(), ok ? new Date().toISOString() : null).run();
  await c.env.DB.prepare("UPDATE leads SET stage = 'demo_sent' WHERE id = ? AND stage IN ('new','called','permission')").bind(l.id).run();
  await audit(c.env, "whatsapp_outreach", l.id, { sent: ok });
  return back(ok ? "WhatsApp sent." : `WhatsApp is not connected yet. Send this link yourself: ${link}`);
});

admin.post("/admin/leads/:id/login-link", async (c) => {
  const l = await getLead(c.env, c.req.param("id"));
  if (!l || !l.shop_id || !l.phone) return c.redirect(go("/admin/leads", undefined, "Build a demo and add a phone number first."));
  const sid = await ensureSeller(c.env, l.shop_id, l.phone, l.owner_name, null);
  const token = await createLoginToken(c.env, sid);
  await audit(c.env, "login_link", l.id);
  const link = `${new URL(c.req.url).origin}/seller/login?token=${token}`;
  return c.html(page("Login link", "leads", html`${pageHead("Seller login link", l.business_name)}<div class="panel"><div class="panel-b"><p style="margin:0 0 10px">This link works once and lasts 7 days. Send it on WhatsApp.</p><div style="padding:12px;border:1px dashed var(--line);border-radius:9px;background:#FAFBFC;word-break:break-all;font-weight:600">${link}</div><p style="margin:16px 0 0"><a class="btn s" href="/admin/leads/${l.id}">Back to lead</a></p></div></div>`));
});

// ---------- shops ----------
admin.get("/admin/shops", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, slug, name, status, expires_at, plan, paid_at, (SELECT COUNT(*) FROM orders o WHERE o.shop_id = shops.id) AS orders, (SELECT COUNT(*) FROM products p WHERE p.shop_id = shops.id AND p.active = 1) AS products FROM shops ORDER BY created_at DESC LIMIT 200").all<{ id: string; slug: string; name: string; status: string; expires_at: string | null; plan: string; paid_at: string | null; orders: number; products: number }>();
  const planLabel: Record<string, string> = { none: "No plan", setup: "Setup paid", support: "Setup + support" };
  const body = html`${pageHead("Shops", `${results.length} shop${results.length === 1 ? "" : "s"}`)}
<div class="panel">${results.length ? results.map((s) => html`<div class="shop"><div class="row" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:16px">${s.name}</b>${statusBadge(s.status)}</div>
<div class="muted sm" style="margin-top:4px">${planLabel[s.plan] ?? s.plan}  |  ${s.products} products  |  ${s.orders} orders  |  ${s.expires_at ? `Ends ${fmtDate(s.expires_at)}` : "No expiry"}</div></div>
<div class="acts"><a class="btn s sm" href="/s/${s.slug}" target="_blank" rel="noopener">${icon("external", 14)}Open preview</a><button type="button" class="btn s sm" data-copy="/s/${s.slug}" onclick="navigator.clipboard.writeText(location.origin+this.dataset.copy).then(function(){this.textContent='Copied'}.bind(this))">Copy link</button>${s.paid_at || s.status === "live" ? "" : html`<form method="post" action="/admin/shops/${s.id}/paid"><button class="btn ok sm">Mark as paid</button></form>`}</div></div>
<details class="more" style="margin-top:12px"><summary>${icon("arrow", 14)}Manage</summary>
<form method="post" action="/admin/shops/${s.id}" class="inl"><div><label>Status</label><select name="status">${["preview", "live", "suspended", "expired"].map((x) => html`<option value="${x}" ${s.status === x ? "selected" : ""}>${x.charAt(0).toUpperCase() + x.slice(1)}</option>`)}</select></div>
<div><label>Expiry date (empty = never)</label><input type="date" name="expires" value="${s.expires_at?.slice(0, 10) ?? ""}"></div>
<div><label>Plan</label><select name="plan">${["none", "setup", "support"].map((x) => html`<option value="${x}" ${s.plan === x ? "selected" : ""}>${planLabel[x]}</option>`)}</select></div><button class="btn">Save</button></form>
<form method="post" action="/admin/shops/${s.id}/extend" class="acts" style="margin-top:12px"><button class="btn s sm" name="days" value="7">Extend 7 days</button><button class="btn s sm" name="days" value="30">Extend 30 days</button></form></details></div>`) : empty("No shops yet", "Build a demo website from a lead and it will appear here.", html`<a class="btn" href="/admin/leads">Go to leads</a>`)}</div>`;
  return c.html(page("Shops", "shops", body, fl(c)));
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
  return c.redirect(go("/admin/shops", `Extended by ${days} days.`));
});
admin.post("/admin/shops/:id/paid", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE shops SET status = 'live', plan = CASE WHEN plan = 'none' THEN 'setup' ELSE plan END, expires_at = NULL, paid_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  await c.env.DB.prepare("UPDATE leads SET stage = 'paid' WHERE shop_id = ?").bind(id).run();
  await audit(c.env, "shop_paid", id);
  return c.redirect(go("/admin/shops", "Shop is live. Send the seller a login link from the lead page."));
});

// ---------- outreach, performance, bot usage, audit ----------
admin.get("/admin/outreach", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT q.status, q.created_at, l.business_name, l.id lid FROM outreach_queue q JOIN leads l ON l.id = q.lead_id ORDER BY q.created_at DESC LIMIT 100").all<{ status: string; created_at: string; business_name: string; lid: string }>();
  const dayStart = istDayStartIso();
  const n = results.filter((r) => r.created_at >= dayStart).length;
  const cap = outreachCap(c.env);
  const label: Record<string, [string, string]> = { sent: ["Sent", "#167C4A"], queued_stub: ["Not sent (WhatsApp not connected)", "#B7791F"] };
  const body = html`${pageHead("Outreach", "First messages go out only after a call with permission.")}
<div class="panel" style="margin-bottom:16px"><div class="panel-b"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:26px;font-weight:650">${n}<span class="muted" style="font-size:15px;font-weight:500"> / ${cap} today</span></span><span class="muted sm">Resets at midnight IST</span></div><div class="prog"><i style="width:${Math.min(100, Math.round((n / cap) * 100))}%"></i></div></div></div>
<div class="panel" style="overflow-x:auto">${results.length ? html`<table class="tbl"><thead><tr><th>Shop</th><th>When</th><th>Status</th></tr></thead><tbody>${results.map((r) => html`<tr><td><a class="who" href="/admin/leads/${r.lid}">${r.business_name}</a></td><td>${fmt(r.created_at)}</td><td><span class="badge" style="--c:${label[r.status]?.[1] ?? "#8A93A6"}">${label[r.status]?.[0] ?? r.status}</span></td></tr>`)}</tbody></table>` : empty("No messages sent yet", "Open a lead, record call permission, then send the preview link.")}</div>`;
  return c.html(page("Outreach", "outreach", body, fl(c)));
});

admin.get("/admin/stats", async (c) => {
  const [leads, called, perm, demos, hot, paid, support, optouts] = await Promise.all([
    one(c.env, "SELECT COUNT(*) n FROM leads"), one(c.env, "SELECT COUNT(*) n FROM leads WHERE stage != 'new'"),
    one(c.env, "SELECT COUNT(DISTINCT lead_id) n FROM consents"), one(c.env, "SELECT COUNT(*) n FROM leads WHERE shop_id IS NOT NULL"),
    one(c.env, "SELECT COUNT(*) n FROM leads WHERE stage = 'hot'"), one(c.env, "SELECT COUNT(*) n FROM shops WHERE paid_at IS NOT NULL"),
    one(c.env, "SELECT COUNT(*) n FROM shops WHERE plan = 'support'"), one(c.env, "SELECT COUNT(*) n FROM consents WHERE revoked_at IS NOT NULL"),
  ]);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + "%" : "-");
  const steps: [string, number, string][] = [["Leads added", leads, ""], ["Contacted", called, pct(called, leads) + " of leads"], ["Gave permission", perm, pct(perm, called) + " of contacted"], ["Demo built", demos, pct(demos, leads) + " of leads"], ["Paid", paid, pct(paid, demos) + " of demos"]];
  const body = html`${pageHead("Performance", "How leads move from first call to paid shop.")}
<div class="kpis">${kpi("Setup revenue", rupees(paid * 1999), `${paid} paid shop${paid === 1 ? "" : "s"}`)}${kpi("Monthly support", rupees(support * 499), `${support} support plan${support === 1 ? "" : "s"}`)}${kpi("Hot leads", hot, "Ready for a closing call", "hot")}${kpi("Opt-outs", optouts, "Permission withdrawn or STOP")}</div>
<div class="panel"><div class="panel-h"><h2>Conversion</h2></div><table class="tbl"><thead><tr><th>Step</th><th class="r">Count</th><th class="r">Conversion</th></tr></thead><tbody>${steps.map(([a, b, d]) => html`<tr><td>${a}</td><td class="r"><b>${b}</b></td><td class="r muted">${d || "-"}</td></tr>`)}</tbody></table></div>`;
  return c.html(page("Performance", "stats", body, fl(c)));
});

admin.get("/admin/bot-usage", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT s.name, SUM(b.ai_calls) calls, SUM(b.input_tokens) tin, SUM(b.output_tokens) tout, SUM(b.est_cost_paise) cost FROM bot_usage b JOIN shops s ON s.id = b.shop_id WHERE b.day >= date('now','-30 day') GROUP BY b.shop_id ORDER BY calls DESC").all<{ name: string; calls: number; tin: number; tout: number; cost: number }>();
  const body = html`${pageHead("Bot usage", "AI calls and estimated cost per shop over the last 30 days.")}
<div class="panel" style="overflow-x:auto">${results.length ? html`<table class="tbl"><thead><tr><th>Shop</th><th class="r">AI calls</th><th class="r">Tokens in</th><th class="r">Tokens out</th><th class="r">Est. cost</th></tr></thead><tbody>${results.map((r) => html`<tr><td class="who">${r.name}</td><td class="r">${r.calls}</td><td class="r">${r.tin}</td><td class="r">${r.tout}</td><td class="r">₹${(r.cost / 100).toFixed(2)}</td></tr>`)}</tbody></table>` : empty("No AI usage yet", "Usage appears here once sellers start sending photos and messages to the bot.")}</div>`;
  return c.html(page("Bot usage", "bot", body, fl(c)));
});

admin.get("/admin/audit", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT at, action, target, meta_json FROM audit_log ORDER BY at DESC LIMIT 100").all<{ at: string; action: string; target: string; meta_json: string }>();
  const body = html`${pageHead("Audit log", "Every action taken in this panel.")}
<div class="panel" style="overflow-x:auto">${results.length ? html`<table class="tbl"><thead><tr><th>When</th><th>Action</th><th class="hide-s">Details</th></tr></thead><tbody>${results.map((r) => html`<tr><td style="white-space:nowrap">${fmt(r.at)}</td><td><b>${ACTION_LABEL[r.action] ?? r.action}</b></td><td class="muted sm hide-s" style="word-break:break-all">${r.meta_json === "{}" ? "" : r.meta_json}</td></tr>`)}</tbody></table>` : empty("Nothing logged yet", "Actions you take in this panel will be recorded here.")}</div>`;
  return c.html(page("Audit log", "audit", body, fl(c)));
});

void raw;
void esc;

// ---------- backup ----------
const BACKUP_TABLES: Record<string, string> = {
  leads: "SELECT * FROM leads", consents: "SELECT * FROM consents", shops: "SELECT * FROM shops", products: "SELECT * FROM products",
  product_images: "SELECT * FROM product_images", orders: "SELECT * FROM orders", order_items: "SELECT * FROM order_items",
  order_events: "SELECT * FROM order_events", audit_log: "SELECT * FROM audit_log",
};
admin.get("/admin/backup", async (c) => {
  const body = html`${pageHead("Backup", "A copy of your business data, saved on your own device.")}
<div class="panel"><div class="panel-b"><p style="margin:0 0 6px">The file holds leads, call permissions, shops, products, orders and the audit log. It does not hold passwords, login links or secret keys.</p><p class="muted sm" style="margin:0 0 16px">It contains phone numbers and addresses. Keep it private and do not upload it anywhere public. Download one every week.</p><a class="btn" href="/admin/backup.json">${icon("backup", 16)}Download backup</a></div></div>`;
  return c.html(page("Backup", "backup", body, fl(c)));
});
admin.get("/admin/backup.json", async (c) => {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), version: 1 };
  for (const [name, sql] of Object.entries(BACKUP_TABLES)) out[name] = (await c.env.DB.prepare(sql + " LIMIT 50000").all()).results;
  await audit(c.env, "backup_download", "json");
  const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="vedhin-backup-${day}.json"`, "cache-control": "no-store" } });
});
