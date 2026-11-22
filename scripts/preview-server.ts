// Local preview WITHOUT Cloudflare: in-memory SQLite + demo shops. Usage: npm run preview
import { createServer } from "node:http";
import { makeDb } from "../test/d1-shim";
import { app } from "../src/index";
import { buildDemoShop } from "../src/lib/demo";
import { newId } from "../src/lib/id";
import { createLoginToken, ensureSeller } from "../src/lib/seller";
import type { Env } from "../src/types";

const m = makeDb();
const env: Env = { DB: m.d1, APP_ENV: "development", AI_PROVIDER: "stub", SESSION_SECRET: "dev", ADMIN_PASSWORD: "admin" };

async function seed() {
  for (const [name, cat, phone] of [["Shree Radhe Krishna Collection", "ladies_dress", "9811111111"], ["Sona Kundan Jewellers", "jewellery", "9822222222"]] as const) {
    const lead = { id: newId(), business_name: name, owner_name: null, phone, category: cat, maps_url: "https://maps.google.com/?q=jodhpur", address: "Sardarpura, Jodhpur", instagram_url: null, shop_id: null };
    m.raw.prepare("INSERT INTO leads (id, created_at, business_name, phone, category, stage) VALUES (?,?,?,?,?,'new')").run(lead.id, new Date().toISOString(), name, phone, cat);
    const r = await buildDemoShop(env, lead);
    console.log(`shop: http://localhost:8799/s/${r.slug}`);
    if (cat === "ladies_dress") {
      m.raw.prepare("UPDATE shops SET status='live', upi_id='demo@upi', plan='setup' WHERE id=?").run(r.shopId);
      const sid = await ensureSeller(env, r.shopId, phone, "Sunita", null);
      console.log(`seller login: http://localhost:8799/seller/login?token=${await createLoginToken(env, sid)}`);
    }
  }
  // Extra sample leads so the founder panel looks lived-in in the local preview.
  const sample: [string, string, string, string, string, number][] = [
    ["Mehendi Rang Boutique", "ladies_dress", "9833000001", "Sardarpura", "hot", 9], ["Gulabo Kurti House", "ladies_dress", "9833000002", "Paota", "hot", 7],
    ["Raj Payal Jewels", "jewellery", "9833000003", "Clock Tower", "editing", 5], ["Navrang Fashion", "ladies_dress", "9833000004", "Shastri Nagar", "demo_sent", 2],
    ["Heera Panna Ornaments", "jewellery", "9833000005", "Jaipur, MI Road", "permission", 0], ["Kesar Suits", "ladies_dress", "9833000006", "Ratanada", "called", 0],
    ["Madhuri Sarees", "ladies_dress", "9833000007", "Chopasni", "stalled", 0], ["Anaar Collection", "ladies_dress", "9833000008", "Sojati Gate", "lost", 0],
  ];
  const now = new Date().toISOString();
  for (const [n, cat, ph, area, stage, score] of sample)
    m.raw.prepare("INSERT INTO leads (id, created_at, business_name, phone, category, area, city, stage, score, rating, reviews) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(newId(), now, n, ph, cat, area, "Jodhpur", stage, score, 4.3, 120);
  m.raw.prepare("INSERT INTO audit_log (id, at, actor, action, target, meta_json) VALUES (?,?,?,?,?,?)").run(newId(), now, "founder", "lead_import", "csv", "{}");
  m.raw.prepare("UPDATE shops SET expires_at = ? WHERE status = 'preview'").run(new Date(Date.now() + 3 * 86400_000).toISOString());
  console.log("admin: http://localhost:8799/admin (password: admin)");
}

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await app.fetch(new Request(`http://localhost:8799${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === "GET" || req.method === "HEAD" ? undefined : body, redirect: "manual" }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8799, () => seed().catch(console.error));
