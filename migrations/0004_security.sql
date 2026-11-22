-- Durable rate limiting (survives across Worker isolates). Used for admin login and order tracking.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
