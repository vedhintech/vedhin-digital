# Founder Panel (Vedhin Admin) Spec

Goal: ek jagah se poora control: leads, demos, consent, expiry, hot alerts, cost.

## Screens
1. **Leads board:** columns = new, called, permission, demo_sent, editing, hot, paid, stalled, lost. Card shows shop name, area, rating, score, last activity, next action date. Filters: category, area, source, score.
2. **Lead detail:** all data, notes, Maps/Instagram links, consent log, chat timeline, preview link, "Build demo" button, "Call done" form (outcome, permission yes/no, time), "Send WhatsApp" button (only enabled if consent granted and daily cap not hit).
3. **Import:** CSV upload (columns: business_name, phone, maps_url, instagram_url, category, area, rating, reviews, address, source). Dedupe by phone. Also a quick-add form for Instagram leads.
4. **Shop control:** per shop status (preview/live/suspended/expired), `expires_at` (set date or "no expiry"), extend +7/+30 buttons, plan, mark paid, open as-seller preview.
5. **Outreach queue:** today's list (cap 30), sent/delivered/replied, pause switch.
6. **Stats:** calls made, permissions, demos sent, editing, hot, paid, conversion %, revenue (setup + monthly), per-category.
7. **Bot cost:** AI calls, tokens, est. cost per seller and total; sellers near limit.
8. **Consent & audit:** every consent record, opt-outs, admin actions.

## Lead scoring (lead-scoring skill)
+2 preview opened 3+ times; +3 chat 7+ messages; +3 logo/photos uploaded; +2 admin-portal demo viewed; +4 asked price/how to buy; +3 pressed "call chahiye"; +1 returned on 2+ different days; -3 no activity 5 days; -5 said STOP. **Score >= 7 -> stage `hot` + Telegram alert.**

## Telegram alert format
"HOT: {shop} ({area}) score {n}. {reason}. Last msg: '{snippet}'. Phone: {phone}. [Call] [Open lead]"
Also alerts for: new order failure, bot limit hit, WhatsApp template rejected, error spike, seller says STOP.

## Expiry control
No default expiry. Founder sets per shop. A daily cron sets `expired` only if `expires_at` passed; expired preview shows a polite "Preview band hai, Vedhin se baat karein" page. Reminders to seller are founder-triggered or optional template.

## Daily founder digest (Telegram, 9 PM)
New leads, calls to make tomorrow, hot leads, demos expiring, revenue today, bot cost today.

## Permissions
Single founder admin now; design roles (admin, helper) for the future helper (limited to leads + support, no billing).

## Acceptance
All counts match DB; consent required to send WhatsApp (enforced server-side, not UI-only); admin actions in audit log; 2FA on login.
