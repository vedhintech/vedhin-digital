CREATE TABLE IF NOT EXISTS seller_login_tokens (id TEXT PRIMARY KEY, seller_id TEXT, token_hash TEXT UNIQUE, expires_at TEXT, used_at TEXT);
CREATE TABLE IF NOT EXISTS bot_state (phone TEXT PRIMARY KEY, shop_id TEXT, state TEXT DEFAULT 'menu', data_json TEXT, change_requests INTEGER DEFAULT 0, edit_messages INTEGER DEFAULT 0, updated_at TEXT);
CREATE TABLE IF NOT EXISTS outreach_queue (id TEXT PRIMARY KEY, lead_id TEXT, status TEXT DEFAULT 'queued', created_at TEXT, sent_at TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS processed_webhooks (id TEXT PRIMARY KEY, at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shop_number ON orders(shop_id, number);
CREATE INDEX IF NOT EXISTS idx_preview_events_shop ON preview_events(shop_id, at);
CREATE INDEX IF NOT EXISTS idx_chat_shop ON chat_messages(shop_id, at);
