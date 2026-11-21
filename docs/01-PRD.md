# Vedhin Technology: Master PRD (v1)

Owner/CEO: Vedhin Technology. Build tool: Claude Code (Pro). Team size: 1 founder.

## 1. Vision
Chhote offline sellers ko "done-for-you" online dukaan dena: premium storefront (PWA) + seller portal, ek din me ready. Seller ko kuch seekhna nahi. Pehle target: Jodhpur aur Jaipur ki **ladies dress** aur **jewellery** sellers (dukaan wale + Instagram/ghar-baithe).

## 2. Problem (seller ki nazar se)
- Website/app mushkil lagta hai, roz ka jhanjhat hai, paise dene ko tayar nahi.
- Orders WhatsApp/DM me bikhre, payment confirm karna, stock, courier tracking sab yaad me.
- Trust offline banta hai, isliye call + demo-first approach.

## 3. Product (Phase 1, MVP)
### 3.1 Customer-facing storefront (PWA, mobile-first)
Browse by category, search, product page (photos, price, size/variant, stock), cart, **guest checkout** (naam, phone, pincode, address), UPI payment instructions + QR + screenshot/UTR upload, order tracking page (status, courier naam, tracking ID, official courier site ka link), "Seller ko WhatsApp karo" button, shop info + Google Maps link + social links.
### 3.2 Seller portal (PWA, installable)
Login (phone OTP). Dashboard (aaj ke orders, pending payments, low stock). Products CRUD (photo camera se, variant, stock, sold-out toggle). Orders (filter, address, screenshot, **Payment confirm/reject**, packed, dispatched + courier + tracking ID). Shop settings (naam, logo, colors, UPI ID, WhatsApp, Maps, social). Share link + QR. Notifications: email + portal push (free); WhatsApp optional.
### 3.3 Chat-se-design (onboarding)
WhatsApp (Hinglish) pe seller link kholta hai ya chat karta hai; bot slots poochta hai (naam, logo, Maps, WhatsApp, social, photos); har jawab pe **live preview** update hota hai. Sirf slots badalte hain (rang, font, banner, section order, text, logo). AI se code nahi likhwana.
### 3.4 Limited WhatsApp bot (seller ke liye)
Photo bhejo -> product draft (naam, description) -> seller price deta hai -> product live. Price/stock/sold-out, order dekhna, dispatch. Limits: see 06-BOT-FLOW.md.
### 3.5 Founder panel (Vedhin admin)
Lead management, preview expiry control, hot-lead alerts (Telegram), consent log, bot cost per seller, conversion numbers. See 07-LEAD-PANEL.md.

## 4. Out of scope (Phase 1)
Buyer-side chatbot, buyer login/Gmail, Razorpay auto-payment, live courier API, marketplace/directory, comment-to-DM automation, multi-language beyond Hinglish, native Play Store/App Store apps, 3D heavy pages.

## 5. Pricing
- **Setup Rs 1999** one-time. "Lifetime" = jab tak platform chal raha hai, subdomain hosting ke saath, fair-use limits ke andar (define in 08-LEGAL).
- **Rs 499/month support plan** (optional): bug support, chatbot fair-use, 2 changes/month. Pehla mahina free. Seller checkout ke last page pe add kar sakta hai.
- Add-ons: custom domain, Razorpay setup (Rs 499), extra template (Rs 499), festival banner (Rs 299), footer branding hatana (Rs 299), 3D hero (Rs 999).
- 2 free changes, uske baad Rs 99/change (jo plan me nahi aata).

## 6. Sales flow
Lead list -> demo site auto-build (stock photos) -> founder call, permission leta hai (consent log) -> WhatsApp pe link -> seller chat me changes -> hot lead alert -> founder close call -> payment -> live. Expiry koi default nahi, founder panel se tay hota hai.

## 7. Success metrics (first 90 days)
40 leads called, 15 demos, 5 paid by week 6, 25-30 paid by week 13, 10+ on Rs 499. Seller 30 din baad bhi har hafte portal kholta hai (retention). Cost per seller/month < Rs 100.

## 8. Principles
1. Result bechna, software nahi. 2. Premium, modern UI, "AI kachra" nahi. 3. Speed premium look se pehle (sasta Android). 4. Seller ka data seller ka. 5. Token/paise ka kharcha hamesha capped. 6. Jo bar-bar hota hai automate karo, bharosa wala kaam founder karta hai.

## 9. Key risks
Seller buys but doesn't use (fix: daily summary, low-stock, order tracking habit). Support load akele (fix: help videos, bot FAQ, part-time helper at 30 sellers). WhatsApp ban (fix: call-permission first, 30/day, STOP line). Photo copyright (fix: stock photos in demo).
