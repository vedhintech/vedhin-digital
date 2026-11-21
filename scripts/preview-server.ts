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
