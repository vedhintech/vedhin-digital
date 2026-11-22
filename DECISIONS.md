# Decisions log

- 2026-11-21: Hosting on Cloudflare Workers + D1 (APAC). Free `*.workers.dev` address for testing; no custom domain until the model is validated.
- 2026-11-21: Tenant routing is path-based (`/s/:slug`) for now; subdomain routing later by changing only the tenant middleware.
- 2026-11-21: R2 (photos) postponed until R2 is enabled in the Cloudflare dashboard; binding is commented in wrangler.toml.
- 2026-11-21: AI provider is `stub` until M6; real providers (Gemini, then Claude Haiku) plug into `AiProvider`.
- 2026-11-21: Tests run on better-sqlite3 with a small D1 shim, using the real migration file.

## 2026-11-22: Language model (founder decision)
- Website = English standard (storefront, seller portal, founder panel). Not Hinglish.
- Buyer storefront has a header language switcher: English, Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Urdu (RTL). Choice kept in `vd_lang` cookie; `?lang=` also works. Per-key English fallback. Per-script Noto font loaded only for the chosen language.
- Seller-entered text (product names, descriptions, banner/headline) is shown exactly as typed; not auto-translated. Empty headline/story/announcement use translated defaults.
- Seller chatbot replies in the language of the seller's last clear message. Hand-written catalogs: English, Hindi, Hinglish. Other Indian languages: the seller's text is translated to English by the AI provider for understanding and the English reply is translated back (budgeted via `bot_usage`, cached). Without AI configured it falls back to English.
- Translations are machine-quality drafts; a native speaker should review before launch.
- Updated CLAUDE.md rule 9 accordingly.
