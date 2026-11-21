# Bot Flow Spec (WhatsApp, Hinglish, seller-facing only in Phase 1)

Principle: buttons first, AI only where needed, hard limits to protect token cost.

## Channels
WhatsApp Cloud API (one Vedhin number). Seller-initiated messages open a 24h free window; replies inside it are free. Anything outside needs an approved template (utility Rs ~0.1-0.15, marketing Rs ~0.8-1: verify current Meta rates). Outreach only after logged call consent.

## States
`LEAD_WELCOME -> ONBOARDING (collect slots) -> PREVIEW_EDITING -> DEMO_TOUR -> PRICING -> PAID_ACTIVE`. Escalation: any state -> `HUMAN_NEEDED` (Telegram alert to founder).

## Opening message (template, after consent)
"Namaste {name} ji, main Vedhin Technology se. Aapki dukaan {shop} ki online preview taiyar hai: {link}. Kuch badalna ho to yahin likh dein, hum kar denge. Band karne ke liye STOP likhein."

## Main menu (seller, buttons)
1 Shop ka design badlo (rang / logo / banner / style) 2 Naya product jodo (photo bhejo) 3 Price ya stock badlo 4 Orders dekho 5 Mera shop link / QR 6 Plan aur rate 7 Mujhe call chahiye 8 Help video.

## Actions and how each is handled
| Action | Handler | AI? |
|---|---|---|
| Rang/font/banner/section change | slot update on `theme_json`, new preview link | No (button/list) |
| Logo | choose from 3 generated options or upload | No |
| Naya product | photo -> AI draft (naam, description, category) -> ask price -> ask stock -> confirm -> live | Yes (1 call) |
| Price/stock/sold out | parse "kangan set 499" with simple rules; fall back to AI intent | Rules first |
| Orders | list from DB with buttons | No |
| Dispatch | ask courier (list) + tracking ID | No |
| Plan/rate | fixed table text (never AI-generated prices) | No |
| Call request | create HUMAN_NEEDED + Telegram alert | No |
| Free-text question | FAQ match (cached) -> else AI short answer (limited) | Limited |

## Hard limits (configurable in DB)
- Demo/preview sellers: 20 AI actions/day, 10 photo drafts/day.
- Paid Rs 499 plan: 100 bot messages/day, 30 AI product drafts/month, extra packs Rs 99 per 10.
- Max photo size 5 MB; one photo per product draft call; compress before AI.
- Voice notes: transcribe (free Whisper tier) up to 60 sec; reject longer.
- If limit hit: friendly message + "founder se baat karein" button. Never silently fail.
- Log every AI call in `bot_usage` with token estimate and cost.

## Guardrails
Bot never invents prices, discounts, delivery promises, or legal/tax advice. Prices only from `shops/products` tables or fixed plan table. Never shares one seller's data with another. Never receives buyer sensitive data through AI. Seller can say "STOP" at any time: set consent revoked, stop outreach.

## Free changes counter
Plan includes 2 free "changes requests" beyond self-serve slots (custom design asks). 3rd onwards: "Ye extra change Rs 99 ka hai, ok?" Payment confirmed manually by founder.

## Escalation triggers (-> founder Telegram)
Seller sends "call", price/payment question, 7+ edit messages, upload of logo+photos, frustration words ("bekar", "kaam nahi kar raha"), bug keywords, repeated failures (2x same step), limit hit.

## Hinglish tone examples
"Ji didi, aapka product add ho gaya. Ab iska price bata dijiye." / "Photo thodi dhundhli lag rahi hai, ek aur seedhi photo bhej sakti hain?" / "Aapka link taiyar hai: ..." Short sentences, no heavy jargon, one question per message.

## Tests
Menu paths, photo draft happy path + bad photo, limit enforcement, STOP handling, Hindi/English mixed input, voice note, duplicate webhook delivery.
