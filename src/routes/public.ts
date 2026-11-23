import { Hono } from "hono";
import type { AppBindings } from "../types";

export const publicPages = new Hono<AppBindings>();

const CSS = `:root{--ink:#14171F;--mut:#5B6475;--line:#E3E6EC;--pri:#1E3A6E;--acc:#E8A33D;--bg:#F7F6F4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 16px/1.6 Inter,system-ui,sans-serif}
.w{max-width:760px;margin:0 auto;padding:28px 16px 56px}h1{font-size:30px;line-height:1.2;margin:0 0 8px}h2{font-size:20px;margin:32px 0 10px}
.lead{color:var(--mut);margin:0 0 24px}.plans{display:grid;gap:14px;grid-template-columns:1fr}@media(min-width:640px){.plans{grid-template-columns:1fr 1fr}}
.plan{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px}.plan b{display:block;font-size:15px;color:var(--mut)}
.price{font-size:34px;font-weight:700;margin:4px 0 2px}.price small{font-size:15px;font-weight:500;color:var(--mut)}
ul{padding-left:20px;margin:10px 0}li{margin:4px 0}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
td{padding:10px 14px;border-bottom:1px solid var(--line)}tr:last-child td{border:0}td:last-child{text-align:right;font-weight:600;white-space:nowrap}
.mut{color:var(--mut);font-size:14px}`;

publicPages.get("/pricing", (c) =>
  c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pricing | Vedhin Technology</title><meta name="description" content="A ready-made online shop for your dress or jewellery business. One-time setup, optional monthly support."><style>${CSS}</style></head><body><main class="w">
<h1>Your online shop, built for you</h1>
<p class="lead">We build your shop, add your products and keep it running. You sell. Payments go straight to your own UPI. We never hold your customers' money.</p>
<div class="plans">
<section class="plan"><b>Setup</b><div class="price">₹1,999 <small>one time</small></div><ul><li>Your own shop link, ready to share</li><li>Seller portal and WhatsApp assistant</li><li>Orders by UPI or cash on delivery</li><li>2 free change requests, then ₹99 each</li></ul></section>
<section class="plan"><b>Support (optional)</b><div class="price">₹499 <small>per month</small></div><ul><li>First month free</li><li>Fixes and help when you need it</li><li>Assistant usage included</li><li>Cancel any time</li></ul></section>
</div>
<h2>Add-ons</h2>
<table><tbody><tr><td>Your own domain name</td><td>Quoted separately</td></tr><tr><td>Online payment gateway setup (your own account)</td><td>₹499</td></tr><tr><td>Extra shop design</td><td>₹499</td></tr><tr><td>Festival banner</td><td>₹299</td></tr><tr><td>Remove Vedhin footer branding</td><td>₹299</td></tr></tbody></table>
<h2>Good to know</h2>
<ul><li>"Lifetime" means as long as the Vedhin platform runs, on our shop link, within fair-use limits for storage, traffic and assistant messages.</li>
<li>You are responsible for your listings, prices, packing, shipping, returns, refunds and taxes. Vedhin is the technology provider, not the seller.</li>
<li>We may change the platform with 60 days' notice and will give you an export of your products and orders.</li>
<li>Setup fee refund: ask within 7 days if your shop is not live.</li></ul>
<p class="mut">Questions? Ask the Vedhin team who called you.</p>
</main></body></html>`));
