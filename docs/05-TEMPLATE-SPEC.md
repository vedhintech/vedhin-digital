# Template Spec (slot-based). Start with 1 dress + 1 jewellery, then expand to 5+5.

A template = fixed layout code + a `theme_json` of slot values. Seller/bot may change only slots.

## Common sections (ordered, toggle on/off, reorder allowed)
`announcement_bar`, `header` (logo, search, cart), `hero` (image/video or optional 3D, headline, CTA), `categories`, `featured_products`, `new_arrivals`, `offer_banner`, `story` (about shop), `reviews` (real only, seller-entered), `instagram_links`, `location` (Maps link, address, timings), `footer` (contact, social, powered-by).

## theme_json shape
```json
{
  "palette": "royal_maroon_gold",
  "font_pair": "serif_sans",
  "logo": {"mode": "generated", "text": "Rang", "icon": "lotus", "url": null},
  "hero": {"type": "image", "image": "stock:ethnic-01", "headline": "...", "cta": "Shop now", "use_3d": false},
  "sections": ["announcement_bar","hero","categories","featured_products","story","location","footer"],
  "announcement": "Free delivery 999+",
  "social": {"instagram": "", "facebook": "", "youtube": ""},
  "contact": {"whatsapp": "", "phone": "", "maps_url": ""}
}
```

## Logo generation (no AI image cost)
Rule-based SVG: shorten long names (e.g. "Shree Radhe Krishna Collection" -> "Radhe" or "SRK"), pick font from palette, add simple icon from a fixed set (lotus, mirror, jhumka, saree fold, bangle, bindi), 3 layouts (stacked, inline, monogram). Seller can pick from 3 options.

## Dress template fields (ladies: suits, kurtis, sarees, lehenga, western)
Product attributes: `fabric`, `work` (embroidery, block print, bandhej, lehariya), `occasion`, `sizes[]` (S-XXL, free size), `size_chart_url`, `care`, `length`, `ready_stock | made_to_order` (+ days), `color`, `set_includes` (kurta/dupatta/bottom).
Categories default: Suits, Kurtis, Sarees, Lehenga, Dupatta, New Arrivals, Sale. Filters: size, colour, price, occasion.

## Jewellery template fields (artificial/imitation, kundan, meenakari, lac, oxidised)
Product attributes: `material`, `type` (necklace, jhumka, bangles, maang tikka, set), `plating`, `anti_tarnish`, `stone`, `weight`, `size` (bangle sizes 2.2-2.10), `occasion`, `care_note`, `ready_stock | made_to_order`, `gift_packaging` (bool).
Categories default: Necklace Sets, Earrings, Bangles, Maang Tikka, Rings, Bridal, Gifting.

## Style variants (the "style quiz")
Royal, Modern Minimal, Colourful/Festive, Soft Pastel (+ later). Each template ships 4 palettes x 2 hero layouts.

## Demo mode
10-15 demo products per category with free-license stock photos (`is_stock = 1`), clearly watermarked "Preview" banner. Seller's real name, logo, address, phone, Maps, socials are filled in. When a seller uploads own product, a stock demo product is removed automatically. Stock photos are never shown on a live paid shop.

## Slots we ask the seller in chat (in order)
1) Shop naam 2) Logo (photo bhejo ya hum banate hain) 3) WhatsApp number 4) Google Maps link 5) Instagram/Facebook link 6) 5-10 product photos 7) UPI ID 8) Style choose (quiz).

## Acceptance for each template
Looks premium at 375px; Lighthouse >= 85; all sections toggle; checkout works end to end; 4 palettes pass contrast; works with 0, 3 and 50 products.
