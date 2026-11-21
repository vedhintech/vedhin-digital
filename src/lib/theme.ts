// Slots only: palettes, fonts, generated SVG logo. No free-form code from seller or AI.
export interface Palette {
  id: string;
  label: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  border: string;
}

export const PALETTES: Record<string, Palette> = {
  gulabi_jaipur: { id: "gulabi_jaipur", label: "Gulabi Jaipur", bg: "#FFF8F6", surface: "#FFFFFF", text: "#241B2F", muted: "#6E6378", primary: "#B8325F", onPrimary: "#FFFFFF", accent: "#E8A33D", border: "#EBDDE0" },
  indigo_bandhej: { id: "indigo_bandhej", label: "Indigo Bandhej", bg: "#F6F6FB", surface: "#FFFFFF", text: "#1B1D3A", muted: "#62648A", primary: "#2D3A8C", onPrimary: "#FFFFFF", accent: "#F28C38", border: "#DFE0EF" },
  royal_maroon_gold: { id: "royal_maroon_gold", label: "Royal Maroon & Gold", bg: "#FBF6F1", surface: "#FFFFFF", text: "#2A1216", muted: "#7A5F62", primary: "#6E1226", onPrimary: "#FFF7E6", accent: "#C9992E", border: "#E9DCCB" },
  emerald_pearl: { id: "emerald_pearl", label: "Emerald & Pearl", bg: "#F5F9F7", surface: "#FFFFFF", text: "#10261F", muted: "#5B7068", primary: "#0F6B52", onPrimary: "#FFFFFF", accent: "#C8A24D", border: "#D9E6E0" },
  mono: { id: "mono", label: "Minimal Black & White", bg: "#FFFFFF", surface: "#FFFFFF", text: "#141414", muted: "#6A6A6A", primary: "#141414", onPrimary: "#FFFFFF", accent: "#B8325F", border: "#E4E4E4" },
};
export const DEFAULT_PALETTE: Record<string, string> = { ladies_dress: "gulabi_jaipur", jewellery: "royal_maroon_gold", other: "mono" };

export const FONT_PAIRS: Record<string, { display: string; body: string; css: string; link: string }> = {
  dress: {
    display: "'Bricolage Grotesque', 'Hind', sans-serif",
    body: "'Hind', system-ui, sans-serif",
    css: "dress",
    link: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Hind:wght@400;500;600&display=swap",
  },
  jewellery: {
    display: "'Cormorant Garamond', 'Hind', serif",
    body: "'Hind', system-ui, sans-serif",
    css: "jewellery",
    link: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Hind:wght@400;500;600&display=swap",
  },
};

export type SectionId = "announcement_bar" | "hero" | "categories" | "featured_products" | "story" | "location" | "footer";
export const ALL_SECTIONS: SectionId[] = ["announcement_bar", "hero", "categories", "featured_products", "story", "location", "footer"];

export interface Theme {
  palette: string;
  hero: { headline: string; sub: string; cta: string; use_3d: boolean };
  sections: SectionId[];
  announcement: string;
  story: string;
  logo: { mode: "generated" | "upload"; text: string; icon: string; layout: "stacked" | "inline" | "monogram"; url: string | null };
}

const ICONS = ["lotus", "mirror", "jhumka", "bangle", "bindi"] as const;

/** Shorten long shop names for the logo: drop filler words, keep the most distinctive word. */
export function shortName(name: string): string {
  const filler = new Set(["shree", "shri", "sri", "the", "and", "&", "collection", "collections", "fashion", "fashions", "boutique", "store", "stores", "shop", "emporium", "jewellers", "jewellery", "jewelers", "garments", "textiles", "creation", "creations", "designer", "enterprises", "traders", "ji", "mata", "baba"]);
  const words = name.replace(/\(.*?\)/g, "").split(/\s+/).filter(Boolean);
  const keep = words.filter((w) => !filler.has(w.toLowerCase().replace(/[^a-z&]/g, "")));
  const base = (keep.length ? keep : words).slice(0, 2).join(" ");
  return base.length > 16 ? base.split(" ")[0]!.slice(0, 16) : base;
}

export function defaultTheme(shopName: string, category: string | null): Theme {
  const jewel = category === "jewellery";
  const sn = shortName(shopName);
  return {
    palette: DEFAULT_PALETTE[category ?? "other"] ?? "mono",
    hero: {
      headline: jewel ? `${sn}: gehne jo kahani kehte hain` : `${sn}: aapki pasand ke naye suits`,
      sub: jewel ? "Haath se chuni hui jewellery, seedhe dukaan se aapke ghar tak." : "Kapde jo dukaan me dekhe, ab ghar baithe order karein.",
      cta: "Collection dekhein",
      use_3d: false,
    },
    sections: ["announcement_bar", "hero", "categories", "featured_products", "story", "location", "footer"],
    announcement: "Poore India me delivery. Order WhatsApp par bhi le sakte hain.",
    story: `${shopName} aapki apni dukaan hai. Ab har naya design aap yahin dekh sakte hain aur seedhe order kar sakte hain.`,
    logo: { mode: "generated", text: sn, icon: ICONS[hashStr(shopName) % ICONS.length]!, layout: "stacked", url: null },
  };
}

export function parseTheme(json: string | null, shopName: string, category: string | null): Theme {
  const base = defaultTheme(shopName, category);
  if (!json) return base;
  try {
    const t = JSON.parse(json) as Partial<Theme>;
    return {
      palette: t.palette && PALETTES[t.palette] ? t.palette : base.palette,
      hero: { ...base.hero, ...(t.hero ?? {}) },
      sections: Array.isArray(t.sections) ? (t.sections.filter((s) => ALL_SECTIONS.includes(s as SectionId)) as SectionId[]) : base.sections,
      announcement: typeof t.announcement === "string" ? t.announcement : base.announcement,
      story: typeof t.story === "string" ? t.story : base.story,
      logo: { ...base.logo, ...(t.logo ?? {}) },
    };
  } catch {
    return base;
  }
}

/** Validate seller-provided theme edits (slots only, length-capped). */
export function sanitizeThemePatch(input: Record<string, unknown>, current: Theme): Theme {
  const str = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.trim().slice(0, max) : fallback);
  const next: Theme = JSON.parse(JSON.stringify(current));
  if (typeof input.palette === "string" && PALETTES[input.palette]) next.palette = input.palette;
  next.hero.headline = str(input.headline, 90, next.hero.headline);
  next.hero.sub = str(input.sub, 160, next.hero.sub);
  next.hero.cta = str(input.cta, 30, next.hero.cta);
  next.announcement = str(input.announcement, 120, next.announcement);
  next.story = str(input.story, 600, next.story);
  if (typeof input.logo_text === "string") next.logo.text = str(input.logo_text, 18, next.logo.text);
  if (typeof input.logo_icon === "string" && (ICONS as readonly string[]).includes(input.logo_icon)) next.logo.icon = input.logo_icon;
  if (input.logo_layout === "stacked" || input.logo_layout === "inline" || input.logo_layout === "monogram") next.logo.layout = input.logo_layout;
  if (Array.isArray(input.sections)) {
    const s = (input.sections as unknown[]).filter((x): x is SectionId => typeof x === "string" && ALL_SECTIONS.includes(x as SectionId));
    if (s.length) next.sections = s;
  }
  return next;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const ICON_PATHS: Record<string, string> = {
  lotus: "M16 6c2 4 2 8 0 12-2-4-2-8 0-12zm-7 5c3 1 5 4 6 8-3-1-5-4-6-8zm14 0c-1 4-3 7-6 8 1-4 3-7 6-8zM8 21h16",
  mirror: "M16 5a7 7 0 100 14 7 7 0 000-14zm0 14v7m-4 0h8",
  jhumka: "M16 5v4m-5 4h10l-2 8h-6zm5 8v4",
  bangle: "M16 7a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 100 10 5 5 0 000-10z",
  bindi: "M16 8c3 3 3 9 0 12-3-3-3-9 0-12zM16 23v1",
};

/** Rule-based SVG logo (no AI cost). Returns an inline <svg> string; text is XML-escaped. */
export function logoSvg(logo: Theme["logo"], color: string, accent: string, height = 44): string {
  const text = (logo.text || "Dukaan").replace(/[<>&"']/g, "");
  const icon = ICON_PATHS[logo.icon] ?? ICON_PATHS.lotus!;
  const initials = text.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  if (logo.layout === "monogram") {
    return `<svg role="img" aria-label="${text}" height="${height}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="20" fill="none" stroke="${accent}" stroke-width="2"/><text x="22" y="28" text-anchor="middle" font-family="inherit" font-size="18" font-weight="700" fill="${color}">${initials}</text></svg>`;
  }
  const w = Math.max(90, text.length * 11 + 46);
  if (logo.layout === "inline") {
    return `<svg role="img" aria-label="${text}" height="${height}" viewBox="0 0 ${w} 32" xmlns="http://www.w3.org/2000/svg"><g transform="scale(.9)" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/></g><text x="34" y="22" font-family="inherit" font-size="19" font-weight="700" fill="${color}">${text}</text></svg>`;
  }
  return `<svg role="img" aria-label="${text}" height="${height}" viewBox="0 0 ${w} 48" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${w / 2 - 16} 0) scale(.8)" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/></g><text x="${w / 2}" y="42" text-anchor="middle" font-family="inherit" font-size="17" font-weight="700" fill="${color}">${text}</text></svg>`;
}

/** Deterministic placeholder art for demo products (stands in for stock photos until seller uploads). */
export function placeholderSvg(seed: string, label: string, p: Palette): string {
  const h = hashStr(seed);
  const hue = h % 360;
  const bg = `hsl(${hue} 55% 88%)`;
  const fg = `hsl(${hue} 45% 38%)`;
  const dots: string[] = [];
  for (let i = 0; i < 28; i++) {
    const x = (hashStr(seed + "x" + i) % 100) * 4;
    const y = (hashStr(seed + "y" + i) % 100) * 5;
    const r = 3 + (hashStr(seed + "r" + i) % 6);
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fg}" opacity=".16"/>`);
  }
  const safe = label.replace(/[<>&"']/g, "").slice(0, 28);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice"><rect width="400" height="500" fill="${bg}"/>${dots.join("")}<g transform="rotate(-12 200 250)" opacity=".55"><rect x="-40" y="228" width="480" height="10" fill="${p.accent}"/><rect x="-40" y="252" width="480" height="4" fill="${fg}"/></g><text x="200" y="440" text-anchor="middle" font-family="sans-serif" font-size="20" fill="${fg}">${safe}</text></svg>`;
}
