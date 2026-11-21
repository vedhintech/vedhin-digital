import type { Env } from "../types";
import { newId } from "./id";
import { defaultTheme } from "./theme";

interface DemoItem { name: string; category: string; price: number; mrp: number; desc: string; attrs: Record<string, unknown> }

const DRESS: DemoItem[] = [
  { name: "Bandhej Cotton Suit", category: "Suits", price: 1299, mrp: 1699, desc: "Soft cotton, bandhej print, 3 piece set.", attrs: { fabric: "Cotton", work: "Bandhej", sizes: "M, L, XL", ready_stock: true } },
  { name: "Block Print Kurti", category: "Kurtis", price: 599, mrp: 799, desc: "Jaipuri block print, roz pehanne layak.", attrs: { fabric: "Cotton", work: "Block print", sizes: "S, M, L, XL", ready_stock: true } },
  { name: "Lehariya Dupatta", category: "Dupatta", price: 449, mrp: 599, desc: "Georgette lehariya dupatta.", attrs: { fabric: "Georgette", work: "Lehariya", ready_stock: true } },
  { name: "Chanderi Silk Saree", category: "Sarees", price: 2199, mrp: 2799, desc: "Halki chanderi silk, tyohaar ke liye.", attrs: { fabric: "Chanderi", occasion: "Festival", ready_stock: true } },
  { name: "Embroidered Anarkali", category: "Suits", price: 1899, mrp: 2399, desc: "Pyaari embroidery wala anarkali set.", attrs: { fabric: "Rayon", work: "Embroidery", sizes: "M, L, XL", ready_stock: false } },
  { name: "Printed Cotton Kurti Set", category: "Kurtis", price: 899, mrp: 1199, desc: "Kurti, palazzo aur dupatta ka set.", attrs: { fabric: "Cotton", sizes: "S, M, L", ready_stock: true } },
  { name: "Mirror Work Lehenga", category: "Lehenga", price: 3499, mrp: 4499, desc: "Shaadi aur tyohaar ke liye mirror work lehenga.", attrs: { fabric: "Silk blend", work: "Mirror work", occasion: "Wedding", ready_stock: false } },
  { name: "Leheriya Georgette Saree", category: "Sarees", price: 1599, mrp: 1999, desc: "Rangeen leheriya, halka aur sundar.", attrs: { fabric: "Georgette", work: "Lehariya", ready_stock: true } },
  { name: "Straight Cut Kurta", category: "Kurtis", price: 699, mrp: 899, desc: "Office aur college ke liye simple kurta.", attrs: { fabric: "Cotton", sizes: "S, M, L, XL", ready_stock: true } },
  { name: "Phulkari Dupatta", category: "Dupatta", price: 549, mrp: 749, desc: "Haath jaisi phulkari kadhai.", attrs: { fabric: "Cotton", work: "Phulkari", ready_stock: true } },
];
const JEWEL: DemoItem[] = [
  { name: "Kundan Necklace Set", category: "Necklace Sets", price: 1499, mrp: 1999, desc: "Kundan necklace, earrings ke saath.", attrs: { material: "Brass", plating: "Gold", stone: "Kundan", anti_tarnish: true, gift_packaging: true, ready_stock: true } },
  { name: "Lac Bangles (set of 6)", category: "Bangles", price: 599, mrp: 799, desc: "Jodhpur ki lac ki chudiyan.", attrs: { material: "Lac", size: "2.4, 2.6, 2.8", gift_packaging: true, ready_stock: true } },
  { name: "Meenakari Jhumka", category: "Earrings", price: 449, mrp: 599, desc: "Rangeen meenakari jhumke.", attrs: { material: "Brass", plating: "Gold", anti_tarnish: true, ready_stock: true } },
  { name: "Oxidised Choker", category: "Necklace Sets", price: 699, mrp: 899, desc: "Oxidised silver look choker.", attrs: { material: "German silver", anti_tarnish: true, ready_stock: true } },
  { name: "Maang Tikka", category: "Maang Tikka", price: 349, mrp: 499, desc: "Dulhan aur tyohaar dono ke liye.", attrs: { material: "Brass", stone: "Kundan", ready_stock: true } },
  { name: "Pearl Drop Earrings", category: "Earrings", price: 399, mrp: 549, desc: "Halke motiyon ke earrings.", attrs: { material: "Alloy", stone: "Pearl", anti_tarnish: true, ready_stock: true } },
  { name: "Bridal Haar Set", category: "Bridal", price: 3299, mrp: 4299, desc: "Shaadi ke liye bhaari haar set.", attrs: { material: "Brass", plating: "Gold", stone: "Kundan", gift_packaging: true, ready_stock: false } },
  { name: "Silver Look Rings (pack of 3)", category: "Rings", price: 299, mrp: 449, desc: "Roz pehanne ke liye 3 anguthiyan.", attrs: { material: "Alloy", ready_stock: true } },
  { name: "Temple Jewellery Set", category: "Necklace Sets", price: 1899, mrp: 2399, desc: "Temple design, haath se banaya hua look.", attrs: { material: "Copper", plating: "Gold", anti_tarnish: true, ready_stock: true } },
  { name: "Thread Bangles Kada", category: "Bangles", price: 499, mrp: 649, desc: "Resham ke dhaage wale kade.", attrs: { material: "Thread", size: "2.4, 2.6", ready_stock: true } },
];

export function slugify(name: string): string {
  const s = name.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/, "");
  return s.length >= 3 ? s : "dukaan-" + s;
}

export interface LeadRow {
  id: string; business_name: string; owner_name: string | null; phone: string | null; category: string | null;
  maps_url: string | null; address: string | null; instagram_url: string | null; shop_id: string | null;
}

/** Creates a preview shop with a slot-based theme and 10 demo products (placeholder art, never copied photos). */
export async function buildDemoShop(env: Env, lead: LeadRow): Promise<{ shopId: string; slug: string }> {
  if (lead.shop_id) {
    const ex = await env.DB.prepare("SELECT id, slug FROM shops WHERE id = ?").bind(lead.shop_id).first<{ id: string; slug: string }>();
    if (ex) return { shopId: ex.id, slug: ex.slug };
  }
  const cat = lead.category === "jewellery" ? "jewellery" : lead.category === "ladies_dress" ? "ladies_dress" : "ladies_dress";
  let slug = slugify(lead.business_name);
  for (let i = 0; i < 6; i++) {
    const taken = await env.DB.prepare("SELECT 1 x FROM shops WHERE slug = ?").bind(slug).first();
    if (!taken) break;
    slug = `${slugify(lead.business_name).slice(0, 26)}-${Math.floor(100 + Math.random() * 900)}`;
  }
  const shopId = newId();
  const now = new Date().toISOString();
  const theme = defaultTheme(lead.business_name, cat);
  const phone = (lead.phone ?? "").replace(/\D/g, "").slice(-10) || null;
  await env.DB.prepare(
    `INSERT INTO shops (id, slug, lead_id, name, tagline, category, status, expires_at, plan, template_id, theme_json, phone, whatsapp, maps_url, address, instagram, created_at)
     VALUES (?,?,?,?,?,?, 'preview', NULL, 'none', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(shopId, slug, lead.id, lead.business_name, cat === "jewellery" ? "Jewellery collection" : "Ladies collection", cat, `${cat === "jewellery" ? "jewellery" : "dress"}-1`, JSON.stringify(theme), phone, phone, lead.maps_url, lead.address, lead.instagram_url, now).run();
  const items = cat === "jewellery" ? JEWEL : DRESS;
  for (const [i, it] of items.entries()) {
    const pid = newId();
    await env.DB.prepare("INSERT INTO products (id, shop_id, name, description, category, price, mrp, stock, active, attributes_json, created_at, source) VALUES (?,?,?,?,?,?,?,?,1,?,?, 'demo')")
      .bind(pid, shopId, it.name, it.desc, it.category, it.price, it.mrp, 5 + (i % 4), JSON.stringify(it.attrs), new Date(Date.now() - i * 1000).toISOString()).run();
    await env.DB.prepare("INSERT INTO product_images (id, product_id, shop_id, url, sort, is_stock) VALUES (?,?,?,?,0,1)")
      .bind(newId(), pid, shopId, `/ph/${slug}-${i}.svg?p=${theme.palette}&l=${encodeURIComponent(it.name)}`).run();
  }
  await env.DB.prepare("UPDATE leads SET shop_id = ? WHERE id = ?").bind(shopId, lead.id).run();
  return { shopId, slug };
}
