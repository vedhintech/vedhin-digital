# Build Plan for Claude Code (milestones with "done" criteria)

Rule: complete one milestone, test, show me, stop. Update DECISIONS.md.

## Prep (before any code)
Create repo, add these docs in `/docs`, copy CLAUDE.md to root. Set up Cloudflare account (free), domain (~Rs 600/yr), Meta developer + WhatsApp Business account, Telegram bot, Gemini API key (free). Verify current free-tier limits and WhatsApp rates.

## M1: Foundation (week 1)
Monorepo, Cloudflare Worker (Hono) + D1 + R2, migrations from 03, subdomain routing (`slug.domain`), i18n file, AiProvider interface (Gemini + stub), CI, lint, tests. **Done:** `/health` works, create a shop row, resolve by slug, tenant-isolation test passes.

## M2: Design system + dress template (week 1-2)
Tokens, components, 1 dress template with 4 palettes, demo data with stock photos, PWA manifest. **Done:** shop page looks premium at 375px, Lighthouse >= 85.

## M3: Storefront commerce (week 2)
Product page, cart, guest checkout, UPI instructions/QR, proof upload, order created, tracking page. **Done:** buyer can place and track a demo order.

## M4: Seller portal (week 2-3)
OTP login, dashboard, products CRUD with camera upload, orders (payment confirm/reject, packed, dispatched, courier + tracking ID), shop settings, share link/QR, email + push notifications. **Done:** full order lifecycle by a non-technical tester.

## M5: Founder panel + lead system (week 3)
Leads CRUD, CSV import, consent log, build-demo action (lead -> shop with theme + stock data), expiry control, stats, Telegram alerts, scoring. **Done:** import 40 leads, build 40 demos in one click each.

## M6: WhatsApp bot (week 3-4)
Webhook, templates, onboarding slots, live preview updates, menu, photo->product draft, price/stock rules, limits, escalation, STOP handling, bot_usage. **Done:** seller adds 10 products via WhatsApp within limits.

## M7: Jewellery template (week 4)
Reuse components; jewellery fields and 4 palettes. **Done:** same checks as M2.

## M8: Hardening + launch kit (week 4-5)
Reviewer agent pass (security, isolation, rate limits), error monitoring, backup export, terms/privacy pages, payment-plan page (Rs 1999 + optional Rs 499), help videos placeholder. **Done:** pilot-ready.

## Phase 1.5 (after first 5-10 paid)
Daily habit features: 9 AM summary, low-stock alerts, payment reminders, festival banner generator. Templates 2-5 for each category. Instagram feed embed. Razorpay (seller's own account). Live courier tracking if cost-justified.

## Pilot plan
Week 5-6: 15 demos, 5 paid at Rs 499-1999, collect video testimonials. Measure: permission rate, edit rate, hot rate, paid rate, weekly active sellers.

## Test checklist (each milestone)
Happy path, bad input, slow network (3G throttle), small Android viewport, tenant isolation, rate limits, cost per action logged.

## Starter prompt to give Claude Code
"Read CLAUDE.md and /docs. We are starting Milestone M1 only. Propose the repo structure and the task list first, wait for my OK, then implement. After finishing, run tests and tell me how to try it."
