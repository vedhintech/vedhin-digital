import { describe, it, expect, beforeEach } from "vitest";
import { setup, seedShop, seedProduct, type Ctx } from "./helpers";
import { createLoginToken, ensureSeller } from "../src/lib/seller";

let c: Ctx;
const buyer = { name: "Priya Sharma", phone: "9812345678", address: "12 Sardarpura, Jodhpur", pincode: "342003", city: "Jodhpur", payment_method: "upi_manual" };

async function loginAs(shopId: string, phone: string): Promise<string> {
  const sid = await ensureSeller(c.env, shopId, phone, "Seller", null);
  const token = await createLoginToken(c.env, sid);
  const r = await c.req(`/seller/login?token=${token}`);
  expect(r.status).toBe(302);
  return (r.headers.get("set-cookie") ?? "").split(";")[0]!;
}
const get = (path: string, cookie: string) => c.req(path, { headers: { cookie } });
const post = (path: string, cookie: string, data: Record<string, string>) =>
  c.req(path, { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data).toString() });

beforeEach(() => {
  c = setup();
  seedShop(c.raw, "A", "shop-a");
  seedShop(c.raw, "B", "shop-b");
  seedProduct(c.raw, "pA", "A", "Suit A", 1000, 5);
  seedProduct(c.raw, "pB", "B", "Suit B", 700, 5);
});

describe("seller auth", () => {
  it("portal redirects to login without a session", async () => {
    const r = await c.req("/seller");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/seller/login");
  });
  it("login token is single-use and bad tokens are refused", async () => {
    const sid = await ensureSeller(c.env, "A", "9000000001", "S", null);
    const token = await createLoginToken(c.env, sid);
    expect((await c.req(`/seller/login?token=${token}`)).status).toBe(302);
    expect((await c.req(`/seller/login?token=${token}`)).status).toBe(401);
    expect((await c.req(`/seller/login?token=nonsense`)).status).toBe(401);
  });
  it("forged session cookie is rejected", async () => {
    const r = await get("/seller", "vd_seller=eyJyb2xlIjoic2VsbGVyIiwiaWQiOiJ4IiwiZXhwIjo5OTk5OTk5OTk5fQ.AAAA");
    expect(r.status).toBe(302);
  });
  it("suspended shop cannot use portal", async () => {
    const ck = await loginAs("A", "9000000001");
    c.raw.prepare("UPDATE shops SET status='suspended' WHERE id='A'").run();
    expect((await get("/seller", ck)).status).toBe(403);
  });
});

describe("seller portal and tenant isolation", () => {
  it("dashboard, products, orders, shop and help render", async () => {
    const ck = await loginAs("A", "9000000001");
    for (const p of ["/seller", "/seller/products", "/seller/products/new", "/seller/products/pA", "/seller/orders", "/seller/shop", "/seller/help"]) {
      expect((await get(p, ck)).status, p).toBe(200);
    }
  });
  it("seller A cannot see or edit shop B's products and orders", async () => {
    const ck = await loginAs("A", "9000000001");
    const r = await get("/seller/products/pB", ck);
    expect(r.status).toBe(302); // redirected with error
    await post("/seller/products/pB", ck, { name: "Hacked", price: "1", stock: "1" });
    expect((c.raw.prepare("SELECT name FROM products WHERE id='pB'").get() as { name: string }).name).toBe("Suit B");
    await post("/seller/products/pB/delete", ck, {});
    expect((c.raw.prepare("SELECT active FROM products WHERE id='pB'").get() as { active: number }).active).toBe(1);
    await c.json("/s/shop-b/api/orders", { ...buyer, items: [{ id: "pB", qty: 1 }] });
    const oid = (c.raw.prepare("SELECT id FROM orders WHERE shop_id='B'").get() as { id: string }).id;
    expect((await get(`/seller/orders/${oid}`, ck)).status).toBe(302);
    await post(`/seller/orders/${oid}/payment`, ck, { action: "confirm" });
    expect((c.raw.prepare("SELECT payment_status FROM orders WHERE id=?").get(oid) as { payment_status: string }).payment_status).toBe("pending");
  });
  it("creates a product (and retires one demo product), enforces limit", async () => {
    c.raw.prepare("INSERT INTO products (id, shop_id, name, price, stock, active, source, created_at) VALUES ('d1','A','Demo',100,5,1,'demo','2020-01-01')").run();
    const ck = await loginAs("A", "9000000001");
    const r = await post("/seller/products", ck, { name: "Meri Kurti", price: "799", stock: "4", category: "Kurtis", image_url: "https://example.com/a.jpg" });
    expect(r.status).toBe(302);
    expect((c.raw.prepare("SELECT COUNT(*) n FROM products WHERE shop_id='A' AND name='Meri Kurti' AND active=1").get() as { n: number }).n).toBe(1);
    expect((c.raw.prepare("SELECT active FROM products WHERE id='d1'").get() as { active: number }).active).toBe(0);
    c.raw.prepare("UPDATE shops SET plan='setup' WHERE id='A'").run();
    for (let i = 0; i < 25; i++) await post("/seller/products", ck, { name: `P${i}x`, price: "10", stock: "1" });
    expect((c.raw.prepare("SELECT COUNT(*) n FROM products WHERE shop_id='A' AND source!='demo' AND active=1").get() as { n: number }).n).toBeLessThanOrEqual(21);
  });
  it("CSRF: cross-origin portal POST is refused", async () => {
    const ck = await loginAs("A", "9000000001");
    const r = await c.req("/seller/products/pA/delete", { method: "POST", headers: { cookie: ck, origin: "https://evil.example" } });
    expect(r.status).toBe(403);
    expect((c.raw.prepare("SELECT active FROM products WHERE id='pA'").get() as { active: number }).active).toBe(1);
  });
});

describe("order lifecycle", () => {
  it("confirm payment, pack, dispatch with tracking, deliver; cancel restores stock", async () => {
    const ck = await loginAs("A", "9000000001");
    const j = (await (await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 2 }] })).json()) as { url: string };
    const k = j.url.split("k=")[1]!;
    await c.json("/s/shop-a/api/orders/1/proof", { k, utr: "123456789012" });
    const oid = (c.raw.prepare("SELECT id FROM orders WHERE shop_id='A'").get() as { id: string }).id;
    // cannot dispatch before payment confirmation
    await post(`/seller/orders/${oid}/tracking`, ck, { courier: "dtdc", tracking_id: "D123456" });
    expect((c.raw.prepare("SELECT status FROM orders WHERE id=?").get(oid) as { status: string }).status).toBe("placed");
    await post(`/seller/orders/${oid}/payment`, ck, { action: "confirm" });
    expect(c.raw.prepare("SELECT status, payment_status FROM orders WHERE id=?").get(oid)).toMatchObject({ status: "confirmed", payment_status: "confirmed" });
    await post(`/seller/orders/${oid}/status`, ck, { status: "packed" });
    await post(`/seller/orders/${oid}/tracking`, ck, { courier: "dtdc", tracking_id: "D123456" });
    expect(c.raw.prepare("SELECT status, courier, tracking_id FROM orders WHERE id=?").get(oid)).toMatchObject({ status: "dispatched", courier: "DTDC", tracking_id: "D123456" });
    const page = await (await c.req(j.url)).text();
    expect(page).toContain("D123456");
    expect(page).toContain("DTDC");
    await post(`/seller/orders/${oid}/status`, ck, { status: "delivered" });
    expect((c.raw.prepare("SELECT status FROM orders WHERE id=?").get(oid) as { status: string }).status).toBe("delivered");
  });
  it("cancel restores stock; illegal transitions are refused", async () => {
    const ck = await loginAs("A", "9000000001");
    await c.json("/s/shop-a/api/orders", { ...buyer, payment_method: "cod", items: [{ id: "pA", qty: 3 }] });
    const oid = (c.raw.prepare("SELECT id FROM orders WHERE shop_id='A'").get() as { id: string }).id;
    expect((c.raw.prepare("SELECT stock FROM products WHERE id='pA'").get() as { stock: number }).stock).toBe(2);
    await post(`/seller/orders/${oid}/status`, ck, { status: "delivered" }); // illegal from placed
    expect((c.raw.prepare("SELECT status FROM orders WHERE id=?").get(oid) as { status: string }).status).toBe("placed");
    await post(`/seller/orders/${oid}/status`, ck, { status: "cancelled" });
    expect((c.raw.prepare("SELECT stock FROM products WHERE id='pA'").get() as { stock: number }).stock).toBe(5);
  });
  it("seller can change theme slots; invalid values are ignored", async () => {
    const ck = await loginAs("A", "9000000001");
    await post("/seller/theme", ck, { headline: "Naya headline", palette: "emerald_pearl", logo_icon: "<script>", announcement: "Diwali offer" });
    const th = JSON.parse((c.raw.prepare("SELECT theme_json FROM shops WHERE id='A'").get() as { theme_json: string }).theme_json);
    expect(th.hero.headline).toBe("Naya headline");
    expect(th.palette).toBe("emerald_pearl");
    expect(th.logo.icon).not.toBe("<script>");
    const html = await (await c.req("/s/shop-a")).text();
    expect(html).toContain("Diwali offer");
  });
});
