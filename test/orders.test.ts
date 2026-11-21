import { describe, it, expect, beforeEach } from "vitest";
import { setup, seedShop, seedProduct, type Ctx } from "./helpers";

let c: Ctx;
const buyer = { name: "Priya Sharma", phone: "9812345678", address: "12 Sardarpura, Jodhpur", pincode: "342003", city: "Jodhpur", payment_method: "upi_manual" };

beforeEach(() => {
  c = setup();
  seedShop(c.raw, "A", "shop-a");
  seedShop(c.raw, "B", "shop-b");
  seedProduct(c.raw, "pA", "A", "Suit A", 1000, 3);
  seedProduct(c.raw, "pB", "B", "Suit B", 700, 3);
});

describe("storefront pages", () => {
  it("renders home, product, cart, checkout, privacy, manifest", async () => {
    for (const path of ["/s/shop-a", "/s/shop-a/p/pA", "/s/shop-a/cart", "/s/shop-a/checkout", "/s/shop-a/privacy", "/s/shop-a/track"]) {
      const r = await c.req(path);
      expect(r.status, path).toBe(200);
      expect(r.headers.get("content-type")).toContain("text/html");
    }
    const m = await (await c.req("/s/shop-a/manifest.webmanifest")).json();
    expect(m).toMatchObject({ display: "standalone", scope: "/s/shop-a/" });
  });
  it("escapes shop names (no XSS)", async () => {
    seedShop(c.raw, "X", "xss-shop", { name: `<script>alert(1)</script>` });
    const html = await (await c.req("/s/xss-shop")).text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("product page of another shop is 404", async () => {
    expect((await c.req("/s/shop-a/p/pB")).status).toBe(404);
  });
  it("preview shops are noindex and log views", async () => {
    seedShop(c.raw, "P", "prev-shop", { status: "preview" });
    const html = await (await c.req("/s/prev-shop")).text();
    expect(html).toContain("noindex");
    const n = c.raw.prepare("SELECT COUNT(*) n FROM preview_events WHERE shop_id='P'").get() as { n: number };
    expect(n.n).toBe(1);
  });
});

describe("cart pricing", () => {
  it("prices from DB and flags unavailable", async () => {
    const r = await c.json("/s/shop-a/api/cart/price", { items: [{ id: "pA", qty: 2 }, { id: "pB", qty: 1 }] });
    const d = (await r.json()) as { subtotal: number; lines: { available: boolean }[] };
    expect(d.subtotal).toBe(2000);
    expect(d.lines[1]!.available).toBe(false); // pB belongs to shop B
  });
});

describe("orders", () => {
  it("places an order, reserves stock, numbers sequentially, ignores client prices", async () => {
    const r1 = await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 2, price: 1 }] });
    expect(r1.status).toBe(201);
    const j1 = (await r1.json()) as { number: number; url: string };
    expect(j1.number).toBe(1);
    const o = c.raw.prepare("SELECT total, payment_status FROM orders WHERE shop_id='A'").get() as { total: number; payment_status: string };
    expect(o).toMatchObject({ total: 2000, payment_status: "pending" });
    expect((c.raw.prepare("SELECT stock FROM products WHERE id='pA'").get() as { stock: number }).stock).toBe(1);
    const r2 = await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 1 }] });
    expect(((await r2.json()) as { number: number }).number).toBe(2);
  });
  it("order numbers are per shop", async () => {
    await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 1 }] });
    const r = await c.json("/s/shop-b/api/orders", { ...buyer, items: [{ id: "pB", qty: 1 }] });
    expect(((await r.json()) as { number: number }).number).toBe(1);
  });
  it("rejects over-stock, bad phone, other shop's product", async () => {
    expect((await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 4 }] })).status).toBe(409);
    expect((await c.json("/s/shop-a/api/orders", { ...buyer, phone: "123", items: [{ id: "pA", qty: 1 }] })).status).toBe(400);
    expect((await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pB", qty: 1 }] })).status).toBe(409);
    expect((c.raw.prepare("SELECT stock FROM products WHERE id='pA'").get() as { stock: number }).stock).toBe(3);
  });
  it("blocks orders on preview shops and UPI without upi_id", async () => {
    seedShop(c.raw, "P", "prev-shop", { status: "preview" });
    seedProduct(c.raw, "pP", "P", "X");
    expect((await c.json("/s/prev-shop/api/orders", { ...buyer, items: [{ id: "pP", qty: 1 }] })).status).toBe(403);
    seedShop(c.raw, "N", "no-upi", { upi_id: null });
    seedProduct(c.raw, "pN", "N", "Y");
    expect((await c.json("/s/no-upi/api/orders", { ...buyer, items: [{ id: "pN", qty: 1 }] })).status).toBe(400);
    expect((await c.json("/s/no-upi/api/orders", { ...buyer, payment_method: "cod", items: [{ id: "pN", qty: 1 }] })).status).toBe(201);
  });
  it("CSRF: cross-origin POST is refused", async () => {
    const r = await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 1 }] }, { origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
});

describe("tracking and payment proof", () => {
  it("order page needs the key; wrong key refused", async () => {
    const j = (await (await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 1 }] })).json()) as { url: string };
    expect((await c.req(j.url)).status).toBe(200);
    expect((await c.req("/s/shop-a/order/1?k=wrongkeywrongkey")).status).toBe(403);
    expect((await c.req("/s/shop-b/order/1?k=" + j.url.split("k=")[1])).status).toBe(403);
  });
  it("track by phone redirects only on match", async () => {
    await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 1 }] });
    expect((await c.req("/s/shop-a/track/go?number=1&phone=9812345678")).status).toBe(302);
    expect((await c.req("/s/shop-a/track/go?number=1&phone=9000000000")).status).toBe(404);
  });
  it("UTR submit sets proof_uploaded; rejects bad key/format", async () => {
    const j = (await (await c.json("/s/shop-a/api/orders", { ...buyer, items: [{ id: "pA", qty: 1 }] })).json()) as { url: string };
    const k = j.url.split("k=")[1]!;
    expect((await c.json("/s/shop-a/api/orders/1/proof", { k: "x".repeat(24), utr: "123456789012" })).status).toBe(403);
    expect((await c.json("/s/shop-a/api/orders/1/proof", { k, utr: "12" })).status).toBe(400);
    expect((await c.json("/s/shop-a/api/orders/1/proof", { k, utr: "123456789012" })).status).toBe(200);
    expect((c.raw.prepare("SELECT payment_status, utr FROM orders WHERE shop_id='A'").get() as { payment_status: string }).payment_status).toBe("proof_uploaded");
  });
});
