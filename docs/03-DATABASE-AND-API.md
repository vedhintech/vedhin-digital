# Database schema (Cloudflare D1 / SQLite) and API list

All shop-owned tables carry `shop_id`. Every query must filter by it. IDs: ULID text. Times: ISO text in UTC. Money: integer paise or rupees (use rupees as integer, no floats).

## Tables
```sql
CREATE TABLE leads (
  id TEXT PRIMARY KEY, created_at TEXT, source TEXT,            -- maps | instagram | referral | manual
  business_name TEXT, owner_name TEXT, phone TEXT, city TEXT, area TEXT,
  category TEXT,                                                 -- ladies_dress | jewellery | other
  maps_url TEXT, instagram_url TEXT, rating REAL, reviews INTEGER, address TEXT,
  stage TEXT DEFAULT 'new',          -- new|called|permission|demo_sent|editing|hot|paid|stalled|lost
  score INTEGER DEFAULT 0, notes TEXT, shop_id TEXT, next_action_at TEXT
);
CREATE TABLE consents (
  id TEXT PRIMARY KEY, lead_id TEXT, phone TEXT, channel TEXT,   -- call | whatsapp_optin
  granted_at TEXT, granted_by TEXT, note TEXT, revoked_at TEXT
);
CREATE TABLE shops (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE, lead_id TEXT, name TEXT, tagline TEXT, category TEXT,
  status TEXT DEFAULT 'preview',    -- preview | live | suspended | expired
  expires_at TEXT,                  -- NULL = no expiry; founder sets it
  plan TEXT DEFAULT 'none',         -- none | setup | support
  template_id TEXT, theme_json TEXT, logo_url TEXT,
  phone TEXT, whatsapp TEXT, email TEXT, maps_url TEXT, address TEXT,
  instagram TEXT, facebook TEXT, youtube TEXT, upi_id TEXT, upi_qr_url TEXT,
  created_at TEXT, paid_at TEXT, custom_domain TEXT
);
CREATE TABLE sellers (
  id TEXT PRIMARY KEY, shop_id TEXT, name TEXT, phone TEXT UNIQUE, email TEXT,
  last_login_at TEXT, lang TEXT DEFAULT 'hinglish', push_token TEXT
);
CREATE TABLE products (
  id TEXT PRIMARY KEY, shop_id TEXT, name TEXT, description TEXT, category TEXT,
  price INTEGER, mrp INTEGER, stock INTEGER, sold_out INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
  attributes_json TEXT,   -- fabric, care, size chart, anti_tarnish, ready_stock, etc. (see 05)
  created_at TEXT, source TEXT   -- portal | whatsapp | demo
);
CREATE TABLE product_images (id TEXT PRIMARY KEY, product_id TEXT, shop_id TEXT, url TEXT, sort INTEGER, is_stock INTEGER DEFAULT 0);
CREATE TABLE product_variants (id TEXT PRIMARY KEY, product_id TEXT, shop_id TEXT, label TEXT, sku TEXT, stock INTEGER, price_delta INTEGER DEFAULT 0);
CREATE TABLE orders (
  id TEXT PRIMARY KEY, shop_id TEXT, number INTEGER, created_at TEXT,
  buyer_name TEXT, buyer_phone TEXT, buyer_email TEXT, address TEXT, pincode TEXT, city TEXT, state TEXT,
  subtotal INTEGER, shipping INTEGER, total INTEGER, payment_method TEXT,   -- upi_manual | cod
  payment_status TEXT DEFAULT 'pending',   -- pending | proof_uploaded | confirmed | rejected | cod
  payment_proof_url TEXT, utr TEXT,
  status TEXT DEFAULT 'placed',            -- placed|confirmed|packed|dispatched|delivered|cancelled|returned
  courier TEXT, tracking_id TEXT, tracking_url TEXT, dispatched_at TEXT, notes TEXT
);
CREATE TABLE order_items (id TEXT PRIMARY KEY, order_id TEXT, shop_id TEXT, product_id TEXT, variant_id TEXT, name TEXT, qty INTEGER, price INTEGER);
CREATE TABLE order_events (id TEXT PRIMARY KEY, order_id TEXT, shop_id TEXT, at TEXT, type TEXT, detail TEXT);
CREATE TABLE templates (id TEXT PRIMARY KEY, category TEXT, name TEXT, version INTEGER, spec_json TEXT, preview_url TEXT);
CREATE TABLE preview_events (id TEXT PRIMARY KEY, shop_id TEXT, at TEXT, type TEXT, meta_json TEXT); -- view | change | demo_portal | call_click
CREATE TABLE chat_messages (id TEXT PRIMARY KEY, shop_id TEXT, lead_id TEXT, at TEXT, direction TEXT, kind TEXT, body TEXT, wa_message_id TEXT);
CREATE TABLE bot_usage (id TEXT PRIMARY KEY, shop_id TEXT, day TEXT, ai_calls INTEGER, input_tokens INTEGER, output_tokens INTEGER, est_cost_paise INTEGER);
CREATE TABLE couriers (id TEXT PRIMARY KEY, name TEXT, tracking_url_template TEXT);  -- DTDC, Maruti, India Post, Delhivery, Other
CREATE TABLE audit_log (id TEXT PRIMARY KEY, at TEXT, actor TEXT, action TEXT, target TEXT, meta_json TEXT);
CREATE INDEX idx_orders_shop ON orders(shop_id, created_at);
CREATE INDEX idx_products_shop ON products(shop_id, active);
CREATE INDEX idx_leads_stage ON leads(stage, score);
```

## API (REST, JSON, Hono). Prefix by area.
**Public storefront** (resolved by subdomain slug): `GET /shop`, `GET /products`, `GET /products/:id`, `POST /cart/price` (validate), `POST /orders` (guest checkout), `POST /orders/:id/proof` (upload), `GET /orders/:number/track?phone=` (buyer tracking, needs phone match), `POST /events` (preview analytics).

**Seller** (auth: OTP session): `POST /auth/otp/send`, `POST /auth/otp/verify`, `GET/PATCH /seller/shop`, `GET/POST/PATCH/DELETE /seller/products`, `POST /seller/products/draft-from-photo` (AI, limited), `GET /seller/orders`, `PATCH /seller/orders/:id/payment` (confirm/reject), `PATCH /seller/orders/:id/status`, `PATCH /seller/orders/:id/tracking`, `GET /seller/dashboard`, `PATCH /seller/theme` (slots only), `POST /seller/upload`.

**Bot / webhooks:** `GET/POST /webhooks/whatsapp` (verify token + signature), `POST /webhooks/telegram`, `POST /internal/jobs/*` (cron only).

**Founder panel** (admin auth + 2FA): `GET/POST/PATCH /admin/leads`, `POST /admin/leads/import` (CSV), `POST /admin/leads/:id/build-demo`, `POST /admin/consents`, `PATCH /admin/shops/:id` (status, expires_at, plan), `POST /admin/outreach/queue`, `GET /admin/stats`, `GET /admin/bot-usage`, `GET /admin/audit`.

## Scheduled jobs (Cron)
Daily 9:00 IST seller summary; hourly hot-lead scoring + Telegram alerts; daily preview-expiry check (only shops with `expires_at` set); outreach queue sender (cap 30/day, 10:00-18:00 IST); weekly low-activity seller check.

## Rules
Tenant isolation test for every route. Idempotent webhooks. Soft-delete products with orders. Order `number` is sequential per shop.
