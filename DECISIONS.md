# Decisions log

- 2026-11-21: Hosting on Cloudflare Workers + D1 (APAC). Free `*.workers.dev` address for testing; no custom domain until the model is validated.
- 2026-11-21: Tenant routing is path-based (`/s/:slug`) for now; subdomain routing later by changing only the tenant middleware.
- 2026-11-21: R2 (photos) postponed until R2 is enabled in the Cloudflare dashboard; binding is commented in wrangler.toml.
- 2026-11-21: AI provider is `stub` until M6; real providers (Gemini, then Claude Haiku) plug into `AiProvider`.
- 2026-11-21: Tests run on better-sqlite3 with a small D1 shim, using the real migration file.
