import { describe, it, expect, beforeEach, vi } from "vitest";
import { setup, seedShop, seedProduct, type Ctx } from "./helpers";
import { totpCode, newTotpSecret, verifyTotp } from "../src/lib/totp";
import { sniffImage } from "../src/lib/seller";

let c: Ctx;
const form = { "content-type": "application/x-www-form-urlencoded" };
beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));

describe("admin 2-step login", () => {
  it("TOTP matches RFC 6238 test vector and rejects wrong codes", async () => {
    // RFC 6238 SHA1 secret "12345678901234567890" = base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ, T=59 -> 94287082 (last 6 digits 287082)
    expect(await totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
    const s = newTotpSecret();
    expect(await verifyTotp(s, await totpCode(s))).toBe(true);
    expect(await verifyTotp(s, "000000")).toBe(false);
  });
  it("login needs password AND code when ADMIN_TOTP_SECRET is set", async () => {
    const secret = newTotpSecret();
    c = setup({ ADMIN_PASSWORD: "pw-123", ADMIN_TOTP_SECRET: secret });
    const login = (body: string) => c.req("/admin/login", { method: "POST", headers: form, body });
    expect((await login("password=pw-123")).status).toBe(401);
    expect((await login("password=pw-123&code=000000")).status).toBe(401);
    const ok = await login(`password=pw-123&code=${await totpCode(secret)}`);
    expect(ok.status).toBe(302);
    expect(ok.headers.get("set-cookie")).toContain("vd_admin=");
  });
  it("production without a TOTP secret shows a setup key instead of a session", async () => {
    c = setup({ ADMIN_PASSWORD: "pw-123", APP_ENV: "production", SESSION_SECRET: "x".repeat(32) });
    const r = await c.req("/admin/login", { method: "POST", headers: { ...form, origin: "http://localhost" }, body: "password=pw-123" });
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(await r.text()).toContain("ADMIN_TOTP_SECRET");
  });
});

describe("hardening", () => {
  it("sends CSP and blocks sniffing", async () => {
    c = setup();
    const r = await c.req("/health");
    expect(r.headers.get("content-security-policy")).toContain("object-src 'none'");
  });
  it("image magic bytes decide the type", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("order is saved atomically with items and event, and a UTR cannot be reused", async () => {
    c = setup();
    seedShop(c.raw, "S1", "rang", { status: "live" });
    seedProduct(c.raw, "P1", "S1", "Suit", 500, 5);
    const order = () => c.req("/s/rang/api/orders", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ name: "Asha", phone: "9876543210", address: "12 MI Road Jaipur", pincode: "302001", city: "Jaipur", payment_method: "upi_manual", items: [{ id: "P1", qty: 1 }] }) });
    const a = (await (await order()).json()) as { number: number; url: string };
    const b = (await (await order()).json()) as { number: number; url: string };
    expect([a.number, b.number]).toEqual([1, 2]);
    expect((c.raw.prepare("SELECT COUNT(*) n FROM order_items").get() as { n: number }).n).toBe(2);
    expect((c.raw.prepare("SELECT COUNT(*) n FROM order_events").get() as { n: number }).n).toBe(2);
    const proof = (u: { number: number; url: string }) => c.req(`/s/rang/api/orders/${u.number}/proof`, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ k: new URL(u.url, "http://x").searchParams.get("k"), utr: "UTR123456789" }) });
    expect((await proof(a)).status).toBe(200);
    expect((await proof(b)).status).toBe(400);
  });
});
