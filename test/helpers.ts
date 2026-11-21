import { makeDb } from "./d1-shim";
import app from "../src/index";
import type { Env } from "../src/types";
import { resetRateLimits } from "../src/lib/rate";

export function setup(extra: Partial<Env> = {}) {
  resetRateLimits();
  const m = makeDb();
  const env: Env = { DB: m.d1, APP_ENV: "test", AI_PROVIDER: "stub", SESSION_SECRET: "test-secret", ADMIN_PASSWORD: "admin-pass", ...extra };
  const req = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: { origin: "http://localhost", ...(init.headers ?? {}) } }, env);
  const json = (path: string, body: unknown, headers: Record<string, string> = {}) => req(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { raw: m.raw, env, req, json };
}
export type Ctx = ReturnType<typeof setup>;

export function seedShop(raw: Ctx["raw"], id: string, slug: string, o: Record<string, unknown> = {}) {
  const r = { status: "live", name: `Shop ${slug}`, category: "ladies_dress", upi_id: "shop@upi", email: null, whatsapp: "9876543210", ...o };
  raw.prepare("INSERT INTO shops (id, slug, name, category, status, upi_id, email, whatsapp, created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, slug, r.name, r.category, r.status, r.upi_id, r.email, r.whatsapp, new Date().toISOString());
}
export function seedProduct(raw: Ctx["raw"], id: string, shopId: string, name: string, price = 500, stock = 5) {
  raw.prepare("INSERT INTO products (id, shop_id, name, price, stock, active, category, created_at) VALUES (?,?,?,?,?,1,'suits',?)").run(id, shopId, name, price, stock, new Date().toISOString());
}
