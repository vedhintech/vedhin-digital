import { describe, it, expect, beforeEach, vi } from "vitest";
import { setup, seedShop, seedProduct, type Ctx } from "./helpers";
import { handleIncoming } from "../src/lib/bot";
import { ensureSeller } from "../src/lib/seller";

let c: Ctx;
let n = 0;
const PHONE = "9822222222";
const say = (text: string, type: "text" | "audio" = "text", mediaId?: string) => handleIncoming(c.env, { id: `o${++n}`, from: "91" + PHONE, type, text, mediaId }, "https://vedhin.example");

async function liveSeller() {
  seedShop(c.raw, "S1", "rang", { status: "live" });
  seedProduct(c.raw, "P1", "S1", "Suit", 500, 5);
  c.raw.prepare("INSERT INTO leads (id, created_at, business_name, phone, shop_id, stage, category) VALUES ('L1',?,?,?,?,'paid','ladies_dress')").run(new Date().toISOString(), "Rang", PHONE, "S1");
  await ensureSeller(c.env, "S1", PHONE, "Asha", null);
}
function order(id: string, number: number, status: string, pay: string) {
  c.raw.prepare("INSERT INTO orders (id, shop_id, number, created_at, buyer_name, buyer_phone, address, pincode, city, subtotal, shipping, total, payment_method, payment_status, status) VALUES (?, 'S1', ?, ?, 'Meena', '9800000001', 'addr', '302001', 'Jaipur', 500, 0, 500, 'upi_manual', ?, ?)").run(id, number, new Date().toISOString(), pay, status);
}
const row = (num: number) => c.raw.prepare("SELECT status, payment_status, courier, tracking_id FROM orders WHERE number = ?").get(num) as { status: string; payment_status: string; courier: string | null; tracking_id: string | null };

beforeEach(() => {
  c = setup();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("orders by chat", () => {
  it("lists open orders, confirms payment, then dispatches with courier and tracking ID", async () => {
    await liveSeller();
    order("O1", 1, "placed", "proof_uploaded");
    const list = (await say("orders"))[0]!;
    expect(list).toContain("#1");
    expect(list).toContain("check payment");
    expect((await say("dispatch 1 dtdc ABC12345"))[0]).toContain("Confirm its payment first");
    expect((await say("confirm 1"))[0]).toContain("confirmed");
    expect(row(1).payment_status).toBe("confirmed");
    expect((await say("dispatch 1 dtdc abc12345"))[0]).toContain("dispatched with DTDC");
    expect(row(1)).toMatchObject({ status: "dispatched", courier: "DTDC", tracking_id: "ABC12345" });
    expect((c.raw.prepare("SELECT COUNT(*) n FROM order_events WHERE order_id = 'O1'").get() as { n: number }).n).toBe(2);
  });

  it("answers in Hinglish and does not mistake 'confirm 12' for a product price", async () => {
    await liveSeller();
    order("O1", 12, "placed", "proof_uploaded");
    await say("namaste");
    const r = (await say("confirm 12"))[0]!;
    expect(r).toMatch(/confirm/i);
    expect(c.raw.prepare("SELECT COUNT(*) n FROM products WHERE price = 12").get()).toEqual({ n: 0 });
    expect(row(12).status).toBe("confirmed");
  });

  it("never touches another shop's order and handles unknown numbers", async () => {
    await liveSeller();
    seedShop(c.raw, "S2", "other", { status: "live" });
    c.raw.prepare("INSERT INTO orders (id, shop_id, number, created_at, buyer_name, buyer_phone, address, pincode, city, subtotal, shipping, total, payment_method, payment_status, status) VALUES ('X1','S2',7,?, 'Z','9800000002','a','302001','Jaipur',1,0,1,'upi_manual','proof_uploaded','placed')").run(new Date().toISOString());
    expect((await say("confirm 7"))[0]).toContain("could not find order #7");
    expect((c.raw.prepare("SELECT status FROM orders WHERE id = 'X1'").get() as { status: string }).status).toBe("placed");
  });

  it("asks to type order-changing commands that came from a voice note", async () => {
    await liveSeller();
    order("O1", 3, "placed", "proof_uploaded");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("graph.facebook.com/v21.0/MID")) return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/x", mime_type: "audio/ogg" }));
      if (String(url).includes("lookaside")) return new Response(new Uint8Array([1, 2, 3]));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: "confirm 3" }) }] } }], usageMetadata: {} }));
    }));
    c = setup({ WHATSAPP_TOKEN: "t", AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" });
    await liveSeller();
    order("O1", 3, "placed", "proof_uploaded");
    const r = (await say("", "audio", "MID"))[0]!;
    expect(r).toContain("Please type this command");
    expect(row(3).status).toBe("placed");
    vi.unstubAllGlobals();
  });

  it("transcribes a voice note and answers read-only commands", async () => {
    c = setup({ WHATSAPP_TOKEN: "t", AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("graph.facebook.com/v21.0/MID")) return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/x", mime_type: "audio/ogg; codecs=opus" }));
      if (String(url).includes("lookaside")) return new Response(new Uint8Array([1, 2, 3]));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: "orders" }) }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } }));
    }));
    await liveSeller();
    order("O1", 4, "placed", "proof_uploaded");
    expect((await say("", "audio", "MID"))[0]).toContain("#4");
    vi.unstubAllGlobals();
  });
});

describe("seller morning summary", () => {
  it("emails only live sellers who have something to do", async () => {
    const { sellerSummaries } = await import("../src/cron");
    c = setup();
    seedShop(c.raw, "S1", "rang", { status: "live" });
    c.raw.prepare("UPDATE shops SET email = 'a@b.co' WHERE id = 'S1'").run();
    expect(await sellerSummaries(c.env)).toBe(0); // nothing to do yet
    c.raw.prepare("INSERT INTO orders (id, shop_id, number, created_at, buyer_name, buyer_phone, address, pincode, city, subtotal, shipping, total, payment_method, payment_status, status) VALUES ('O9','S1',1,?, 'M','9800000001','a','302001','J',1,0,1,'upi_manual','proof_uploaded','placed')").run(new Date().toISOString());
    expect(await sellerSummaries(c.env)).toBe(1);
  });
});
