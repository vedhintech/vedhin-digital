import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setup, seedShop, type Ctx } from "./helpers";
import { createLoginToken, ensureSeller } from "../src/lib/seller";

let c: Ctx;
async function loginAs(shopId: string): Promise<string> {
  const sid = await ensureSeller(c.env, shopId, "9812345678", "Seller", null);
  const token = await createLoginToken(c.env, sid);
  const r = await c.req(`/seller/login?token=${token}`);
  return (r.headers.get("set-cookie") ?? "").split(";")[0]!;
}
const png = () => { const fd = new FormData(); fd.append("image", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])], "p.png", { type: "image/png" })); return fd; };

beforeEach(() => { c = setup({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" }); seedShop(c.raw, "A", "shop-a"); });
afterEach(() => vi.unstubAllGlobals());

describe("photo to product draft in the seller portal", () => {
  it("product form shows the fill-from-photo button", async () => {
    const ck = await loginAs("A");
    const t = await (await c.req("/seller/products/new", { headers: { cookie: ck } })).text();
    expect(t).toContain("Fill name and details from photo");
    expect(t).toContain("/seller/api/draft-from-photo");
  });
  it("returns a draft from Gemini and uses the configured model", async () => {
    const ck = await loginAs("A");
    const f = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"Bandhej Suit","description":"Red cotton suit.","category":"Suits"}' }] } }], usageMetadata: {} })));
    vi.stubGlobal("fetch", f);
    const r = await c.req("/seller/api/draft-from-photo", { method: "POST", headers: { cookie: ck }, body: png() });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { draft: { name: string } }).draft.name).toBe("Bandhej Suit");
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("gemini-3.5-flash-lite");
  });
  it("gives a friendly error when Gemini fails", async () => {
    const ck = await loginAs("A");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    const r = await c.req("/seller/api/draft-from-photo", { method: "POST", headers: { cookie: ck }, body: png() });
    expect(r.status).toBe(502);
    expect(((await r.json()) as { error: string }).error).toContain("type the details");
  });
});
