# Vedhin Digital

Done-for-you online shops for small sellers (ladies dress + jewellery, Jodhpur/Jaipur first): premium storefront (PWA), seller portal, limited Hinglish WhatsApp bot, founder panel. One Cloudflare Worker + D1. Rules for Claude Code: `CLAUDE.md`. Specs: `/docs`.

## What is built (all milestones)
| Area | Where |
|---|---|
| Storefront (dress + jewellery variants), cart, guest checkout, UPI/UTR proof, order tracking, PWA | `src/routes/storefront.ts`, `src/views/storefront.ts` |
| Seller portal (magic-link login, products, orders, payment confirm, dispatch + courier ID, shop settings, theme slots) | `src/routes/seller.ts`, `src/views/portal.ts` |
| Founder panel (leads, CSV import, consent, demo builder, shop control, stats, bot cost, audit) | `src/routes/admin.ts` |
| WhatsApp bot (signature check, idempotent, Hinglish menu, design by chat, add product by photo, price/stock/sold-out, limits, STOP, escalation) | `src/lib/bot.ts`, `src/routes/webhooks.ts` |
| Cron (hourly: expire previews, hot-lead scoring + Telegram alert; 9 PM IST digest) | `src/cron.ts` |
| AI provider interface (stub, Gemini) | `src/ai/` |

## Try it locally (no Cloudflare needed)
```
npm install
npm run preview      # demo shops + seller login link + admin (password: admin) on http://localhost:8799
npm test             # 67 tests
npm run typecheck
```

## Deploy (one time, about 15 minutes)
1. **Merge** branch `m1-foundation` into `main` on GitHub.
2. Cloudflare dashboard: Workers & Pages, Create, Import from Git, choose this repo. Build command: none. Deploy command: `npx wrangler deploy`.
3. Database `vedhin-db` already exists and has the schema. For a fresh DB run `npm run db:migrate:remote`.
4. Set secrets (Worker, Settings, Variables and Secrets, type "Secret"). Never commit them:
   - `SESSION_SECRET`: long random string (required)
   - `ADMIN_PASSWORD`: your admin password (required for /admin)
   - Later: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `MAIL_FROM`
5. To use Gemini for photo-to-product, set variable `AI_PROVIDER=gemini` (and the key).
6. Enable R2 in the dashboard, create bucket `vedhin-media`, uncomment the `[[r2_buckets]]` block in `wrangler.toml`. Until then, sellers paste an image link instead of uploading.
7. Open `https://<your-worker>.workers.dev/health` then `/admin`.

### Connect WhatsApp (Meta)
Webhook URL `https://<worker>/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`. Create an approved utility/marketing template named `vedhin_preview_link` (Hindi, 3 variables: name, shop, link, and a STOP line) for first outreach.
### Connect Telegram
`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<worker>/webhooks/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>`; your chat id goes in `TELEGRAM_CHAT_ID`.

## Daily founder flow
Panel: import leads, "Demo website banayein", call the seller, record permission, "Preview link bhejein" (max 30/day, consent enforced), watch Hot alerts on Telegram, close the call, "Paid mark karein", "Naya login link banayein" and send it on WhatsApp.

## Known limits (honest list)
- Admin has a password only; TOTP 2FA is not built yet.
- Bot cannot dispatch orders or read voice notes yet (orders go through the portal; voice needs a speech-to-text provider).
- No QR image for UPI (UPI app link + UPI ID are shown; seller QR upload is a later add-on).
- Razorpay/Cashfree auto-payment, live courier tracking API, comment-to-DM and the marketplace are Phase 2 (see `docs/01-PRD.md`).
- Free-tier limits and WhatsApp/Gemini rates change: re-check before launch.
- Legal text in `docs/08-LEGAL-AND-CONSENT.md` is a working draft: get a CA/lawyer to review.
