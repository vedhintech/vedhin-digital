# Design System (modern, premium, not "AI-generic")

Audience: (a) sellers, often first-time digital, mostly phone; (b) shoppers, mostly women on mid/low-end Android. Principle: **simple, calm, fast, feminine-premium without being cliche.**

## Foundations
- **Mobile-first:** design at 375px; scale up. Thumb-friendly: tap targets >= 48px, primary actions in bottom half.
- **Speed:** WebP/AVIF, lazy images, skeleton loaders, system fallback fonts, JS budget < 150 KB on shop pages.
- **Accessibility:** contrast AA, font >= 16px body, visible focus, alt text for products.

## Typography
- Shop display headings: a refined serif (e.g. Playfair Display / Cormorant) for jewellery, a clean geometric sans (e.g. Poppins / Manrope) for dress templates. Body: Inter or Noto Sans (supports Devanagari for later). Max 2 families per template.
- Seller portal: Inter/Noto Sans only. Scale: 12 / 14 / 16 / 20 / 24 / 32.

## Colour (tokens, themeable per shop)
Each template ships 4 palettes (e.g. Royal Maroon+Gold, Blush+Charcoal, Emerald+Cream, Minimal Black+White). Tokens: `--bg --surface --text --muted --primary --accent --success --danger --border`. Portal uses neutral off-white + one Vedhin accent. No gradients as default; one subtle gradient allowed in hero only.

## Components
Buttons (primary, secondary, ghost; 12px radius), product card (4:5 image, name, price, "sold out" tag), sticky bottom bar on product page (Add to cart + WhatsApp), cart drawer, checkout stepper (3 steps max), status timeline (Packed -> Dispatched -> Delivered), toast, empty states with friendly Hinglish line, skeleton loaders, bottom tab bar in seller portal (Home, Orders, Products, Shop, Help).

## Layout & motion
8-pt spacing grid; generous white space; image-led. Motion: 150-250ms ease-out, only meaningful (add to cart, status change). Respect `prefers-reduced-motion`. **3D/Parallax:** optional hero block, off by default, lazy loaded, disabled on low-end devices.

## Seller portal UX rules
- One primary action per screen. Big "Naya product jodo" button.
- Orders screen: cards with status chip + one next-step button ("Payment confirm karo", "Dispatch karo").
- Confirm destructive actions. Show plain Hinglish errors ("Photo thodi badi hai, dobara try karein").
- Inline 30-second help video per screen ("Ye kaise karein?").
- Works offline-lite: draft product saved locally if network drops.

## Trust elements on storefront
Shop name + logo, "Real dukaan" badge only if Maps link verified, Maps/Call/WhatsApp buttons, clear returns/shipping note (seller-editable), UPI trust line, footer "Powered by Vedhin Technology" (removable add-on).

## Don'ts
Emoji as icons, random stock-photo mismatches, lorem ipsum, more than 2 fonts, centered paragraph walls, auto-playing sound/video, popups on first load.

## Deliverable checks (designer agent)
Screenshot at 375px and 768px; Lighthouse mobile performance >= 85; contrast check; tap-target check.
