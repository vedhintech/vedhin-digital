# CLAUDE.md: Vedhin Seller Platform

Read this first in every session. Product details: 01-PRD.md. Do not build anything listed as out of scope there.

## What we are building
Done-for-you online shop (PWA storefront + seller portal + limited Hinglish WhatsApp bot + founder panel) for small ladies dress and jewellery sellers in Jodhpur/Jaipur. Solo founder, near-zero infra budget.

## Tech stack (default, do not change without asking)
- Language: TypeScript everywhere.
- Frontend: Astro or Next.js static/edge-friendly, Tailwind CSS, PWA (manifest + service worker). Mobile-first.
- Backend: Cloudflare Workers (Hono framework), D1 (SQLite) database, R2 file storage, Cron Triggers for scheduled jobs. Hosting on Cloudflare Workers (static assets served by the same Worker). No Vercel; GitHub Pages cannot run the backend.
- Multi-tenant: ONE app, many shops. **Current (no custom domain yet): path-based `https://<worker>.workers.dev/s/<slug>`.** When we buy a domain, switch to `slug.<our-domain>` by changing only `src/middleware/tenant.ts` slug extraction. Never generate a separate codebase per seller.
- Auth: phone OTP (provider abstracted). Founder panel: separate admin login + 2FA.
- Messaging: WhatsApp Cloud API (direct from Meta), Telegram Bot for founder alerts, email for seller notifications.
- AI: through ONE interface `AiProvider` (`src/ai/provider.ts`). Dev: Gemini free tier. Production: Claude Haiku. Switching must be a config change.

## Hard rules
1. **Cost cap:** any feature must work within free tiers where possible. Warn me before adding anything that costs money.
2. **AI usage:** rules and buttons first, AI only for (a) photo -> product draft, (b) understanding Hinglish/voice intent, (c) short help answers. Never use AI to write app code at runtime. Enforce per-seller daily limits in `bot_usage` table (see 06-BOT-FLOW.md). Cache repeated answers.
3. **Privacy:** never send buyer address/phone to a free-tier AI. Only product photos and seller text. Do not log secrets or full phone numbers in plain logs.
4. **Photos:** demo sites use free-license stock images only. Never scrape or hotlink Google Maps/Instagram photos of a shop. Seller photos are used only after the seller sends them.
5. **Money:** we never hold customer money. Payment goes directly to seller's UPI. Auto gateway (Razorpay/Cashfree) is seller's own account, Phase 2. Verify webhook signatures when added.
6. **WhatsApp:** first outreach only after founder's call + logged consent (`consents` table). Max 30 outreach/day (configurable). Always include "STOP" opt-out. Respect opt-outs immediately.
7. **Slots, not code:** design changes = changing values in `shop_theme` JSON (colors, font, banner, section order, logo, texts). No free-form HTML from seller or AI.
8. **Security:** validate all input (zod), rate-limit OTP and public endpoints, escape output, tenant isolation on EVERY query (`WHERE shop_id = ?`), file uploads: type + size checks (max 5 MB, convert to WebP).
9. **Language:** bot and UI text in simple Hinglish (Roman script) by default. Tone: respectful "aap", "didi/ma'am". Strings live in `src/i18n/hinglish.ts`, never hardcoded.
10. **Performance:** product pages < 150 KB JS, images lazy + WebP, 3D only in optional hero and off by default.

## Design
Follow 04-DESIGN-SYSTEM.md strictly. No generic AI look: no purple-gradient defaults, no emoji as icons, no lorem ipsum.

## Workflow
- Work milestone by milestone from 10-BUILD-PLAN.md. After each: run tests, show me how to try it, then stop.
- Write small commits. Add tests for order flow, auth, tenant isolation, bot limits.
- Ask before: new paid service, schema-breaking change, anything outside current milestone.
- Keep a `DECISIONS.md` log of choices made.

## Subagents (create in `.claude/agents/`)
- **builder:** implements tasks. **reviewer:** security/tenant-isolation/bug review after each milestone. **designer:** checks UI vs design system on 375px width. **tester:** runs the checklist for the milestone.

## Skills (create in `.claude/skills/`)
- `template-generator`: shop data -> theme JSON -> preview. `hinglish-tone`: UI/bot copy rules. `lead-scoring`: scoring rules from 07.
