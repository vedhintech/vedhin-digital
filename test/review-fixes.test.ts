import { describe, it, expect, beforeEach, vi } from "vitest";
import { setup, seedShop, seedProduct, type Ctx } from "./helpers";
import { handleIncoming } from "../src/lib/bot";
import { releaseStaleOrders } from "../src/cron";

let c: Ctx;
let n = 0;
const say = (from: string, text: string) => handleIncoming(c.env, { id: `r${++n}`, from: "91" + from, type: "text", text }, "https://vedhin.example");
beforeEach(() => {
  c = setup();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function lead(phone: string, shopId: string | null) {
  c.raw.prepare("INSERT INTO leads (id, created_at, business_name, phone, shop_id, stage) VALUES (?,?,?,?,?, 'demo_sent')").run("L" + phone, new Date().toISOString(), "X", phone, shopId);
  c.raw.prepare("INSERT INTO consents (id, lead_id, phone, channel, granted_at, granted_by) VALUES (?,?,?,?,?,?)").run("C" + phone, "L" + phone, phone, "call", new Date().toISOString(), "founder");
}

describe("review fixes", () => {
  it("STOP in Tamil revokes consent, even for a lead with no shop yet", async () => {
    lead("9822222222", null);
    await say("9822222222", "நிறுத்து");
    const row = c.raw.prepare("SELECT revoked_at FROM consents WHERE phone = '9822222222'").get() as { revoked_at: string | null };
    expect(row.revoked_at).not.toBeNull();
    expect((c.raw.prepare("SELECT stage FROM leads WHERE phone = '9822222222'").get() as { stage: string }).stage).toBe("lost");
  });

  it("'nahi chahiye ye colour' is not a STOP", async () => {
    seedShop(c.raw, "S1", "rang", { status: "preview" });
    lead("9833333333", "S1");
    await say("9833333333", "nahi chahiye ye colour");
    expect((c.raw.prepare("SELECT revoked_at FROM consents WHERE phone = '9833333333'").get() as { revoked_at: string | null }).revoked_at).toBeNull();
  });

  it("stale unpaid UPI orders are cancelled once and stock is restored", async () => {
    seedShop(c.raw, "S1", "rang");
    seedProduct(c.raw, "P1", "S1", "Suit", 500, 3);
    const old = new Date(Date.now() - 49 * 3600_000).toISOString();
    c.raw.prepare("INSERT INTO orders (id, shop_id, number, created_at, buyer_name, buyer_phone, address, pincode, city, subtotal, shipping, total, payment_method, payment_status, status) VALUES ('O1','S1',1,?, 'A','9800000000','addr','302001','Jaipur',500,0,500,'upi_manual','pending','placed')").run(old);
    c.raw.prepare("INSERT INTO order_items (id, order_id, shop_id, product_id, name, qty, price) VALUES ('I1','O1','S1','P1','Suit',2,500)").run();
    expect(await releaseStaleOrders(c.env)).toBe(1);
    expect(await releaseStaleOrders(c.env)).toBe(0);
    expect((c.raw.prepare("SELECT stock FROM products WHERE id='P1'").get() as { stock: number }).stock).toBe(5);
  });
});
