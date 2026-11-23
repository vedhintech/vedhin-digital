import { describe, it, expect, beforeEach } from "vitest";
import { setup, seedShop, type Ctx } from "./helpers";

let c: Ctx;
beforeEach(() => { c = setup(); });
async function login(): Promise<string> {
  const r = await c.req("/admin/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=admin-pass" });
  return (r.headers.get("set-cookie") ?? "").split(";")[0]!;
}

describe("M8 launch kit", () => {
  it("serves the public pricing page", async () => {
    const r = await c.req("/pricing");
    expect(r.status).toBe(200);
    const t = await r.text();
    expect(t).toContain("1,999");
    expect(t).toContain("499");
  });
  it("backup needs admin login", async () => {
    const r = await c.req("/admin/backup.json");
    expect([302, 401, 403]).toContain(r.status);
  });
  it("backup downloads data without secrets", async () => {
    seedShop(c.raw, "s1", "demo");
    const ck = await login();
    const r = await c.req("/admin/backup.json", { headers: { cookie: ck } });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toContain("vedhin-backup-");
    const j = (await r.json()) as Record<string, unknown[]>;
    expect(j.shops!.length).toBe(1);
    expect(JSON.stringify(j)).not.toContain("admin-pass");
    expect("seller_login_tokens" in j).toBe(false);
  });
  it("unhandled error returns 500 and does not crash alerting", async () => {
    const bad = { ...c.env, DB: { prepare() { throw new Error("boom"); } } as never };
    const { app } = await import("../src/index");
    const r = await app.request("/health", {}, bad);
    expect(r.status).toBe(500);
  });
});
