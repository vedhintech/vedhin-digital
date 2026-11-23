import { describe, it, expect, beforeEach, vi } from "vitest";
import { setup, seedShop, seedProduct, type Ctx } from "./helpers";
import { handleIncoming, LIMITS } from "../src/lib/bot";
import { verifySignature } from "../src/lib/wa";
import { ensureSeller } from "../src/lib/seller";

let c: Ctx;
const BASE = "https://vedhin.example";
let n = 0;
const say = (from: string, text: string, type: "text" | "image" | "audio" = "text") => handleIncoming(c.env, { id: `m${++n}`, from: "91" + from, type, text }, BASE);

function seedLead(phone: string, shopId: string, slug: string, status = "preview") {
  seedShop(c.raw, shopId, slug, { status });
  c.raw.prepare("INSERT INTO leads (id, created_at, business_name, phone, shop_id, stage, category) VALUES (?,?,?,?,?,'demo_sent','ladies_dress')").run("L" + shopId, new Date().toISOString(), "Rang Boutique", phone, shopId);
}
async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const payload = (id: string, from: string, text: string) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from, type: "text", text: { body: text } }] } }] }] });

let alerts: string[];
beforeEach(() => {
  c = setup({ WHATSAPP_APP_SECRET: "appsecret", WHATSAPP_VERIFY_TOKEN: "verify-me" });
  alerts = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { if (String(a[0]).startsWith("[telegram:stub]")) alerts.push(String(a[1])); });
});

describe("webhook security", () => {
  it("verification handshake", async () => {
    expect((await c.req("/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=123")).status).toBe(200);
    expect((await c.req("/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123")).status).toBe(403);
  });
  it("rejects bad signature, accepts valid, refuses when secret missing", async () => {
    seedLead("9811111111", "S1", "rang");
    const body = payload("w1", "919811111111", "menu");
    expect((await c.req("/webhooks/whatsapp", { method: "POST", headers: { "x-hub-signature-256": "sha256=deadbeef" }, body })).status).toBe(401);
    const sig = "sha256=" + (await hmacHex("appsecret", body));
    expect((await c.req("/webhooks/whatsapp", { method: "POST", headers: { "x-hub-signature-256": sig }, body })).status).toBe(200);
    const c2 = setup({ WHATSAPP_APP_SECRET: undefined });
    expect((await c2.req("/webhooks/whatsapp", { method: "POST", body })).status).toBe(503);
    expect(await verifySignature("k", "x", undefined)).toBe(false);
  });
  it("duplicate delivery is processed once", async () => {
    seedLead("9811111111", "S1", "rang");
    const body = payload("dup1", "919811111111", "menu");
    const sig = "sha256=" + (await hmacHex("appsecret", body));
    for (let i = 0; i < 3; i++) await c.req("/webhooks/whatsapp", { method: "POST", headers: { "x-hub-signature-256": sig }, body });
    expect((c.raw.prepare("SELECT COUNT(*) n FROM chat_messages WHERE direction='in' AND wa_message_id='dup1'").get() as { n: number }).n).toBe(1);
  });
  it("telegram webhook needs its secret and the right chat", async () => {
    const c2 = setup({ TELEGRAM_WEBHOOK_SECRET: "tg", TELEGRAM_CHAT_ID: "42" });
    expect((await c2.req("/webhooks/telegram", { method: "POST", body: "{}" })).status).toBe(403);
    expect((await c2.req("/webhooks/telegram", { method: "POST", headers: { "x-telegram-bot-api-secret-token": "tg" }, body: JSON.stringify({ message: { chat: { id: 1 }, text: "/digest" } }) })).status).toBe(200);
  });
});

describe("bot conversation", () => {
  beforeEach(() => seedLead("9811111111", "S1", "rang"));

  it("unknown numbers get a polite reply and the founder is alerted", async () => {
    const r = await say("9000000000", "hello");
    expect(r[0]).toContain("Vedhin Technology");
    expect(alerts.some((a) => a.includes("Unknown number"))).toBe(true);
  });
  it("menu and fixed plan text (prices come from constants, never AI)", async () => {
    expect((await say("9811111111", "hi"))[0]).toContain("1. Change design");
    const plan = (await say("9811111111", "6"))[0]!;
    expect(plan).toContain("₹1999");
    expect(plan).toContain("₹499");
  });
  it("design commands update theme slots without AI", async () => {
    await say("9811111111", "rang emerald");
    await say("9811111111", "banner Diwali par 10% off");
    const th = JSON.parse((c.raw.prepare("SELECT theme_json FROM shops WHERE id='S1'").get() as { theme_json: string }).theme_json);
    expect(th.palette).toBe("emerald_pearl");
    expect(th.announcement).toBe("Diwali par 10% off");
    expect((c.raw.prepare("SELECT COUNT(*) n FROM bot_usage").get() as { n: number }).n).toBe(0);
    expect((await say("9811111111", "rang neela"))[0]).toContain("/s/rang");
  });
  it("7 edits trigger an INTERESTED alert; a lead who writes first gets an opt-in record", async () => {
    for (let i = 0; i < 7; i++) await say("9811111111", `headline Naya ${i}`);
    expect(alerts.some((a) => a.includes("INTERESTED"))).toBe(true);
    expect((c.raw.prepare("SELECT COUNT(*) n FROM consents WHERE channel='whatsapp_optin'").get() as { n: number }).n).toBe(1);
  });
  it("add product via photo: price then stock; replaces one demo product; AI usage logged", async () => {
    c.raw.prepare("INSERT INTO products (id, shop_id, name, price, stock, active, source, created_at) VALUES ('d1','S1','Demo',100,5,1,'demo','2020-01-01')").run();
    expect((await say("9811111111", "2"))[0]).toContain("photo");
    expect((await say("9811111111", "", "image"))[0]).toContain("price");
    expect((await say("9811111111", "799"))[0]).toContain("How many pieces");
    expect((await say("9811111111", "4"))[0]).toContain("is added");
    expect(c.raw.prepare("SELECT price, stock, source FROM products WHERE source='whatsapp'").get()).toMatchObject({ price: 799, stock: 4 });
    expect((c.raw.prepare("SELECT active FROM products WHERE id='d1'").get() as { active: number }).active).toBe(0);
    expect((c.raw.prepare("SELECT SUM(ai_calls) n FROM bot_usage").get() as { n: number }).n).toBe(1);
  });
  it("rejects nonsense price/stock during the flow", async () => {
    await say("9811111111", "2"); await say("9811111111", "", "image");
    expect((await say("9811111111", "bahut mehnga"))[0]).toContain("number");
    expect((await say("9811111111", "9999999"))[0]).toContain("number");
  });
  it("price, stock and sold-out rules by product name; ambiguity asks which", async () => {
    seedProduct(c.raw, "p1", "S1", "Kangan Set", 300, 5);
    seedProduct(c.raw, "p2", "S1", "Kundan Kangan", 600, 5);
    expect((await say("9811111111", "kundan kangan 650"))[0]).toContain("650");
    expect((c.raw.prepare("SELECT price FROM products WHERE id='p2'").get() as { price: number }).price).toBe(650);
    expect((await say("9811111111", "kangan 499"))[0]).toContain("Which product");
    await say("9811111111", "stock kangan set 12");
    expect((c.raw.prepare("SELECT stock FROM products WHERE id='p1'").get() as { stock: number }).stock).toBe(12);
    await say("9811111111", "kangan set khatam");
    expect((c.raw.prepare("SELECT sold_out FROM products WHERE id='p1'").get() as { sold_out: number }).sold_out).toBe(1);
    // "khatam" is Hinglish, so the bot has switched to Hinglish by now.
    expect((await say("9811111111", "nothere 99"))[0]).toContain("nahi mila");
  });
  it("cannot touch another shop's products (tenant isolation)", async () => {
    seedShop(c.raw, "S2", "other");
    seedProduct(c.raw, "pX", "S2", "Secret Saree", 1000, 5);
    expect((await say("9811111111", "secret saree 11"))[0]).toContain("could not find");
    expect((await say("9811111111", "secret saree 100"))[0]).toContain("could not find");
    expect((c.raw.prepare("SELECT price FROM products WHERE id='pX'").get() as { price: number }).price).toBe(1000);
  });
  it("STOP revokes consent, marks lead lost, confirms", async () => {
    await say("9811111111", "hi");
    const r = await say("9811111111", "STOP");
    expect(r[0]).toContain("will not message you");
    expect((c.raw.prepare("SELECT stage FROM leads WHERE id='LS1'").get() as { stage: string }).stage).toBe("lost");
    expect((c.raw.prepare("SELECT COUNT(*) n FROM consents WHERE revoked_at IS NULL").get() as { n: number }).n).toBe(0);
  });
  it("'7' (call) alerts founder; price question alerts and returns the fixed plan", async () => {
    await say("9811111111", "7");
    expect(alerts.some((a) => a.includes("CALL REQUESTED"))).toBe(true);
    const r = await say("9811111111", "kitna paisa lagega");
    expect(r[0]).toContain("₹1999");
    expect(alerts.some((a) => a.includes("PRICE QUESTION"))).toBe(true);
  });
  it("voice notes get an honest reply; unknown text twice escalates", async () => {
    expect((await say("9811111111", "", "audio"))[0]).toContain("voice note");
    await say("9811111111", "asdf qwer"); await say("9811111111", "zxcv");
    expect(alerts.some((a) => a.includes("STUCK"))).toBe(true);
  });
  it("daily message cap protects cost and never fails silently", async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < LIMITS.previewMessagesPerDay; i++) c.raw.prepare("INSERT INTO chat_messages (id, shop_id, at, direction, kind, body) VALUES (?,?,?,'in','text','x')").run("c" + i, "S1", now);
    expect((await say("9811111111", "menu"))[0]).toContain("limit");
    expect(alerts.some((a) => a.includes("LIMIT"))).toBe(true);
  });
  it("AI daily budget blocks photo drafts", async () => {
    for (let i = 0; i < LIMITS.previewAiPerDay; i++) c.raw.prepare("INSERT INTO bot_usage (id, shop_id, day, ai_calls, input_tokens, output_tokens, est_cost_paise) VALUES (?,?,?,1,0,0,0)").run("u" + i, "S1", new Date().toISOString().slice(0, 10));
    expect((await say("9811111111", "", "image"))[0]).toContain("limit");
  });
});

describe("paid seller", () => {
  it("orders summary includes a single-use portal link; extra changes beyond 2 mention ₹99", async () => {
    seedShop(c.raw, "S3", "paid-shop", { status: "live" });
    await ensureSeller(c.env, "S3", "9822222222", "Sunita", null);
    const r = await say("9822222222", "4");
    expect(r[0]).toContain("/seller/login?token=");
    await say("9822222222", "logo ko bada karo");
    await say("9822222222", "banner hatao please");
    const third = await say("9822222222", "colour badal do");
    expect(third[0]).toContain("₹99");
  });
});

describe("seller chat language (replies in the seller's own language)", () => {
  beforeEach(() => seedLead("9822222222", "SL", "lang-shop"));
  const stateLang = (phone: string) => (c.raw.prepare("SELECT lang FROM bot_state WHERE phone = ?").get(phone) as { lang: string } | undefined)?.lang;

  it("English in, English out", async () => {
    expect((await say("9822222222", "please show me the menu"))[0]).toContain("Change design");
    expect(stateLang("9822222222")).toBe("en");
  });
  it("Hinglish in, Hinglish out", async () => {
    expect((await say("9822222222", "mujhe menu dikhao"))[0]).toContain("Design badlo");
    expect(stateLang("9822222222")).toBe("hinglish");
  });
  it("Hindi (Devanagari) in, Hindi out, and Devanagari commands work", async () => {
    const r = await say("9822222222", "नमस्ते");
    expect(r[0]).toContain("डिज़ाइन बदलें");
    expect(stateLang("9822222222")).toBe("hi");
    expect((await say("9822222222", "रंग गुलाबी"))[0]).toContain("/s/lang-shop");
    expect((await say("9822222222", "६"))[0]).toContain("₹1999");
  });
  it("short ambiguous messages keep the previous language", async () => {
    await say("9822222222", "mujhe menu dikhao");
    expect((await say("9822222222", "6"))[0]).toContain("ek baar");
    expect(stateLang("9822222222")).toBe("hinglish");
  });
  it("seller can switch language mid-chat", async () => {
    await say("9822222222", "mujhe menu dikhao");
    expect((await say("9822222222", "i want to see my shop link please"))[0]).toContain("Your shop link");
    expect(stateLang("9822222222")).toBe("en");
  });
  it("other Indian languages (Tamil) fall back to English when no AI is configured, and remember the language", async () => {
    const r = await say("9822222222", "வணக்கம்");
    expect(r[0]).toBeTruthy();
    expect(stateLang("9822222222")).toBe("ta");
  });
  it("other Indian languages get AI-translated replies and understood input (translate called with seller text only)", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      const prompt: string = body.contents[0].parts[0].text;
      calls.push(prompt);
      const out = prompt.includes("into English") ? "menu" : "[TA] reply";
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: out }) }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }), { status: 200 });
    }));
    const env = { ...c.env, AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" };
    const r = await handleIncoming(env, { id: "ta1", from: "919822222222", type: "text", text: "மெனு காட்டு" }, BASE);
    expect(r[0]).toBe("[TA] reply");
    expect(calls.some((p) => p.includes("into English") && p.includes("மெனு காட்டு"))).toBe(true);
    expect(calls.every((p) => !p.includes("9822222222"))).toBe(true);
    vi.unstubAllGlobals();
  });
});
