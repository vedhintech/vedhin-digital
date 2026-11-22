import { describe, it, expect, beforeEach } from "vitest";
import { setup, type Ctx } from "./helpers";
import { computeScore } from "../src/lib/scoring";
import { scoreLeads, expirePreviews } from "../src/cron";
import { parseCsv } from "../src/lib/csv";

let c: Ctx;
async function login(): Promise<string> {
  const r = await c.req("/admin/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=admin-pass" });
  expect(r.status).toBe(302);
  return (r.headers.get("set-cookie") ?? "").split(";")[0]!;
}
const post = (path: string, ck: string, data: Record<string, string>) => c.req(path, { method: "POST", headers: { cookie: ck, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data).toString() });
const get = (path: string, ck: string) => c.req(path, { headers: { cookie: ck } });
const leadId = () => (c.raw.prepare("SELECT id FROM leads ORDER BY created_at DESC LIMIT 1").get() as { id: string }).id;

beforeEach(() => { c = setup(); });

describe("admin auth", () => {
  it("requires login; wrong password refused; brute force limited", async () => {
    expect((await c.req("/admin")).status).toBe(302);
    const bad = () => c.req("/admin/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=nope" });
    expect((await bad()).status).toBe(401);
    for (let i = 0; i < 8; i++) await bad();
    expect((await bad()).status).toBe(429);
  });
  it("seller cookie does not grant admin", async () => {
    expect((await c.req("/admin", { headers: { cookie: "vd_seller=abc.def" } })).status).toBe(302);
  });
  it("503 when ADMIN_PASSWORD missing", async () => {
    const c2 = setup({ ADMIN_PASSWORD: undefined });
    const r = await c2.req("/admin/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=x" });
    expect(r.status).toBe(503);
  });
});

describe("leads, demo, consent, outreach", () => {
  it("adds leads, dedupes by phone, imports CSV", async () => {
    const ck = await login();
    await post("/admin/leads", ck, { business_name: "Rang Boutique", phone: "9811111111", category: "ladies_dress", area: "Sardarpura" });
    await post("/admin/leads", ck, { business_name: "Rang Boutique 2", phone: "+91 98111 11111" });
    expect((c.raw.prepare("SELECT COUNT(*) n FROM leads").get() as { n: number }).n).toBe(1);
    await post("/admin/leads/import", ck, { csv: 'business_name,phone,category\n"Sona, Jewellers",9822222222,jewellery\nBad,123,x\nKundan House,9833333333,Jewellery' });
    expect((c.raw.prepare("SELECT COUNT(*) n FROM leads").get() as { n: number }).n).toBe(3);
    expect((c.raw.prepare("SELECT category FROM leads WHERE phone='9822222222'").get() as { category: string }).category).toBe("jewellery");
  });
  it("builds a demo shop with 10 placeholder products that renders publicly", async () => {
    const ck = await login();
    await post("/admin/leads", ck, { business_name: "Shree Radhe Krishna Collection", phone: "9811111111", category: "jewellery" });
    await post(`/admin/leads/${leadId()}/build-demo`, ck, {});
    const shop = c.raw.prepare("SELECT slug, status, category FROM shops").get() as { slug: string; status: string; category: string };
    expect(shop).toMatchObject({ status: "preview", category: "jewellery" });
    expect((c.raw.prepare("SELECT COUNT(*) n FROM products WHERE source='demo'").get() as { n: number }).n).toBe(10);
    const r = await c.req(`/s/${shop.slug}`);
    expect(r.status).toBe(200);
    const page = await r.text();
    expect(page).toContain("Preview");
    expect(page).toContain("/ph/");
    const ph = await c.req((page.match(/\/ph\/[^"]+/) ?? [""])[0]!.replace(/&amp;/g, "&"));
    expect(ph.headers.get("content-type")).toContain("svg");
    await post(`/admin/leads/${leadId()}/build-demo`, ck, {}); // idempotent
    expect((c.raw.prepare("SELECT COUNT(*) n FROM shops").get() as { n: number }).n).toBe(1);
  });
  it("WhatsApp outreach is blocked without consent (server-side), allowed with it, capped daily", async () => {
    const ck = await login();
    await post("/admin/leads", ck, { business_name: "Rang Boutique", phone: "9811111111" });
    const id = leadId();
    await post(`/admin/leads/${id}/build-demo`, ck, {});
    await post(`/admin/leads/${id}/send-whatsapp`, ck, {});
    expect((c.raw.prepare("SELECT COUNT(*) n FROM outreach_queue").get() as { n: number }).n).toBe(0);
    await post(`/admin/leads/${id}/consent`, ck, { decision: "yes", note: "haan bhej do" });
    expect((c.raw.prepare("SELECT stage FROM leads WHERE id=?").get(id) as { stage: string }).stage).toBe("permission");
    await post(`/admin/leads/${id}/send-whatsapp`, ck, {});
    expect(c.raw.prepare("SELECT status FROM outreach_queue").get()).toMatchObject({ status: "queued_stub" });
    expect((c.raw.prepare("SELECT stage FROM leads WHERE id=?").get(id) as { stage: string }).stage).toBe("demo_sent");
    // cap
    const now = new Date().toISOString();
    for (let i = 0; i < 29; i++) c.raw.prepare("INSERT INTO outreach_queue (id, lead_id, status, created_at) VALUES (?,?,?,?)").run("q" + i, id, "sent", now);
    await post(`/admin/leads/${id}/send-whatsapp`, ck, {});
    expect((c.raw.prepare("SELECT COUNT(*) n FROM outreach_queue").get() as { n: number }).n).toBe(30);
  });
  it("saying no revokes consent and marks lost", async () => {
    const ck = await login();
    await post("/admin/leads", ck, { business_name: "Rang Boutique", phone: "9811111111" });
    const id = leadId();
    await post(`/admin/leads/${id}/consent`, ck, { decision: "yes", note: "ok" });
    await post(`/admin/leads/${id}/consent`, ck, { decision: "no", note: "mana kiya" });
    expect((c.raw.prepare("SELECT stage FROM leads WHERE id=?").get(id) as { stage: string }).stage).toBe("lost");
    expect((c.raw.prepare("SELECT COUNT(*) n FROM consents WHERE revoked_at IS NULL").get() as { n: number }).n).toBe(0);
  });
  it("login link lets the seller into the portal", async () => {
    const ck = await login();
    await post("/admin/leads", ck, { business_name: "Rang Boutique", phone: "9811111111" });
    const id = leadId();
    await post(`/admin/leads/${id}/build-demo`, ck, {});
    const page = await (await post(`/admin/leads/${id}/login-link`, ck, {})).text();
    const link = (page.match(/\/seller\/login\?token=[A-Za-z0-9_-]+/) ?? [""])[0]!;
    expect(link).not.toBe("");
    expect((await c.req(link)).status).toBe(302);
  });
  it("shop control: mark paid goes live, no expiry; extend; expiry cron spares live shops", async () => {
    const ck = await login();
    await post("/admin/leads", ck, { business_name: "Rang Boutique", phone: "9811111111" });
    const id = leadId();
    await post(`/admin/leads/${id}/build-demo`, ck, {});
    const sid = (c.raw.prepare("SELECT id FROM shops").get() as { id: string }).id;
    c.raw.prepare("UPDATE shops SET expires_at='2020-01-01T00:00:00Z' WHERE id=?").run(sid);
    await post(`/admin/shops/${sid}/extend`, ck, { days: "7" });
    expect((c.raw.prepare("SELECT status FROM shops WHERE id=?").get(sid) as { status: string }).status).toBe("preview");
    c.raw.prepare("UPDATE shops SET expires_at='2020-01-01T00:00:00Z' WHERE id=?").run(sid);
    expect(await expirePreviews(c.env)).toBe(1);
    await post(`/admin/shops/${sid}/paid`, ck, {});
    expect(c.raw.prepare("SELECT status, plan, expires_at FROM shops WHERE id=?").get(sid)).toMatchObject({ status: "live", plan: "setup", expires_at: null });
    expect((c.raw.prepare("SELECT stage FROM leads WHERE id=?").get(id) as { stage: string }).stage).toBe("paid");
    expect(await expirePreviews(c.env)).toBe(0);
  });
  it("all admin pages render", async () => {
    const ck = await login();
    for (const p of ["/admin", "/admin/leads/new", "/admin/shops", "/admin/outreach", "/admin/stats", "/admin/bot-usage", "/admin/audit"]) expect((await get(p, ck)).status, p).toBe(200);
  });
  it("CSRF: cross-origin admin POST refused", async () => {
    const ck = await login();
    const r = await c.req("/admin/leads", { method: "POST", headers: { cookie: ck, origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" }, body: "business_name=Hack" });
    expect(r.status).toBe(403);
  });
});

describe("scoring", () => {
  const base = { views: 0, inboundMessages: 0, uploadedAssets: false, demoPortalViews: 0, askedPrice: false, callRequested: false, activeDays: 0, daysSinceActivity: null, optedOut: false };
  it("follows the documented rules", () => {
    expect(computeScore({ ...base, askedPrice: true, uploadedAssets: true })).toBe(7);
    expect(computeScore({ ...base, views: 3, inboundMessages: 7 })).toBe(5);
    expect(computeScore({ ...base, askedPrice: true, daysSinceActivity: 6 })).toBe(1);
    expect(computeScore({ ...base, askedPrice: true, optedOut: true })).toBe(-1);
  });
  it("cron promotes a lead to hot once and ignores lost/paid leads", async () => {
    const ck = await login();
    await post("/admin/leads", ck, { business_name: "Rang Boutique", phone: "9811111111" });
    const id = leadId();
    await post(`/admin/leads/${id}/build-demo`, ck, {});
    const sid = (c.raw.prepare("SELECT id FROM shops").get() as { id: string }).id;
    const now = new Date().toISOString();
    c.raw.prepare("INSERT INTO chat_messages (id, shop_id, at, direction, kind, body) VALUES ('m1',?,?,'in','text','1999 me kya kya milega, price batao')").run(sid, now);
    c.raw.prepare("INSERT INTO chat_messages (id, shop_id, at, direction, kind, body) VALUES ('m2',?,?,'in','image','')").run(sid, now);
    const r = await scoreLeads(c.env);
    expect(r.hot).toBe(1);
    expect((c.raw.prepare("SELECT stage FROM leads WHERE id=?").get(id) as { stage: string }).stage).toBe("hot");
    expect((await scoreLeads(c.env)).hot).toBe(0);
  });
});

describe("csv", () => {
  it("handles quotes, commas and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y",2\r\n')).toEqual([{ a: "x, y", b: "2" }]);
  });
});
