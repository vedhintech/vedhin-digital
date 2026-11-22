import { describe, it, expect, beforeEach } from "vitest";
import { setup, seedShop, seedProduct, type Ctx } from "./helpers";
import { LANGS, tr } from "../src/i18n";
import { en } from "../src/i18n/ui-en";

let c: Ctx;
beforeEach(() => {
  c = setup();
  seedShop(c.raw, "S1", "rang", { status: "live" });
  seedProduct(c.raw, "p1", "S1", "Kundan Set", 999, 5);
});
const text = async (path: string, init?: RequestInit) => (await c.req(path, init)).text();

describe("buyer language switcher", () => {
  it("defaults to English and offers every language in the header", async () => {
    const h = await text("/s/rang");
    expect(h).toContain('<html lang="en" dir="ltr">');
    for (const l of LANGS) expect(h).toContain(`value="${l.code}"`);
    expect(h).toContain("Shop the collection");
  });
  it("?lang= switches the page and remembers it in a cookie", async () => {
    const r = await c.req("/s/rang?lang=hi");
    const h = await r.text();
    expect(h).toContain('<html lang="hi"');
    expect(h).toContain("कलेक्शन देखें");
    expect(r.headers.get("set-cookie")).toContain("vd_lang=hi");
    const next = await text("/s/rang/cart", { headers: { cookie: "vd_lang=hi" } });
    expect(next).toContain("आपका कार्ट");
  });
  it("Urdu is right-to-left; Tamil loads its own font", async () => {
    expect(await text("/s/rang?lang=ur")).toContain('dir="rtl"');
    expect(await text("/s/rang?lang=ta")).toContain("Noto+Sans+Tamil");
  });
  it("an unknown language is ignored (stays English)", async () => {
    expect(await text("/s/rang?lang=xx")).toContain('<html lang="en"');
  });
  it("seller-written text is never translated or altered", async () => {
    const h = await text("/s/rang?lang=gu");
    expect(h).toContain("Kundan Set");
  });
  it("API errors follow the buyer's language", async () => {
    const r = await c.req("/s/nope?lang=hi");
    expect(r.status).toBe(404);
    expect(await r.text()).toContain("यह दुकान नहीं मिली");
    const e = await c.req("/s/nope");
    expect(await e.text()).toContain("This store was not found");
  });
  it("hero text set by the seller wins over the translated default", async () => {
    c.raw.prepare("UPDATE shops SET theme_json = ? WHERE id = 'S1'").run(JSON.stringify({ hero: { headline: "Diwali Sale" } }));
    expect(await text("/s/rang?lang=hi")).toContain("Diwali Sale");
  });
});

describe("dictionaries", () => {
  it("every language falls back to English for a missing key, never empty", () => {
    for (const l of LANGS) for (const k of Object.keys(en) as (keyof typeof en)[]) expect(tr(l.code, k, { n: 1, name: "A", shop: "B", amount: "₹1" }).length).toBeGreaterThan(0);
  });
  it("Hindi covers every English key", async () => {
    const { hi } = await import("../src/i18n/ui-hi");
    expect(Object.keys(en).filter((k) => !(k in hi))).toEqual([]);
  });
  it("placeholders are preserved in every translation", async () => {
    const { others } = await import("../src/i18n/ui-in");
    const { hi } = await import("../src/i18n/ui-hi");
    for (const [code, d] of Object.entries({ hi, ...others }) as [string, Record<string, string>][])
      for (const [k, v] of Object.entries(d)) {
        const want = ((en as Record<string, string>)[k]?.match(/\{\w+\}/g) ?? []).sort().join();
        const got = (v.match(/\{\w+\}/g) ?? []).sort().join();
        expect(`${code}.${k}:${got}`).toBe(`${code}.${k}:${want}`);
      }
  });
});
