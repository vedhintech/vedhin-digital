import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeDb } from "./d1-shim";
import type { Env } from "../src/types";

let env: Env;
let raw: ReturnType<typeof makeDb>["raw"];

function addShop(id: string, slug: string, extra: Record<string, unknown> = {}) {
  const row = { status: "preview", expires_at: null, name: `Shop ${slug}`, ...extra };
  raw
    .prepare("INSERT INTO shops (id, slug, name, status, expires_at) VALUES (?,?,?,?,?)")
    .run(id, slug, row.name, row.status, row.expires_at);
}
function addProduct(id: string, shopId: string, name: string) {
  raw
    .prepare("INSERT INTO products (id, shop_id, name, price, stock, active, created_at) VALUES (?,?,?,?,?,1,?)")
    .run(id, shopId, name, 499, 5, new Date().toISOString());
}
const get = (path: string) => app.request(path, {}, env);

beforeEach(() => {
  const m = makeDb();
  raw = m.raw;
  env = { DB: m.d1, APP_ENV: "test", AI_PROVIDER: "stub" };
});

describe("health", () => {
  it("returns ok and db reachable", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect((await res.json()) as { db: boolean }).toMatchObject({ status: "ok", db: true });
  });
});

describe("tenant resolution", () => {
  it("resolves shop by slug", async () => {
    addShop("s1", "rang-jodhpur");
    const res = await get("/s/rang-jodhpur/api/shop");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ slug: "rang-jodhpur", preview: true });
  });
  it("404 for unknown or reserved/invalid slug", async () => {
    expect((await get("/s/nope-shop/api/shop")).status).toBe(404);
    expect((await get("/s/admin/api/shop")).status).toBe(404);
    expect((await get("/s/A_B/api/shop")).status).toBe(404);
  });
  it("410 for expired preview, 403 for suspended, NULL expiry never expires", async () => {
    addShop("s2", "old-shop", { expires_at: "2020-01-01T00:00:00Z" });
    addShop("s3", "bad-shop", { status: "suspended" });
    addShop("s4", "forever-shop", { expires_at: null });
    expect((await get("/s/old-shop/api/shop")).status).toBe(410);
    expect((await get("/s/bad-shop/api/shop")).status).toBe(403);
    expect((await get("/s/forever-shop/api/shop")).status).toBe(200);
  });
  it("live shop with a past expires_at is still served", async () => {
    addShop("s5", "paid-shop", { status: "live", expires_at: "2020-01-01T00:00:00Z" });
    expect((await get("/s/paid-shop/api/shop")).status).toBe(200);
  });
});

describe("tenant isolation", () => {
  beforeEach(() => {
    addShop("A", "shop-a");
    addShop("B", "shop-b");
    addProduct("pA", "A", "Product of A");
    addProduct("pB", "B", "Product of B");
  });
  it("lists only own products", async () => {
    const body = (await (await get("/s/shop-a/api/products")).json()) as { products: { name: string }[] };
    expect(body.products.map((p) => p.name)).toEqual(["Product of A"]);
  });
  it("cannot fetch another shop's product by id", async () => {
    expect((await get("/s/shop-a/api/products/pB")).status).toBe(404);
    expect((await get("/s/shop-b/api/products/pB")).status).toBe(200);
  });
  it("hides inactive products", async () => {
    raw.prepare("UPDATE products SET active = 0 WHERE id = 'pA'").run();
    const body = (await (await get("/s/shop-a/api/products")).json()) as { products: unknown[] };
    expect(body.products).toHaveLength(0);
  });
});
