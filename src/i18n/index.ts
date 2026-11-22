// Language support. Website default = English. Buyers can switch to any language below (UI text only).
// Seller-written content (product names, descriptions, banner text) is shown exactly as the seller typed it.
import { en, type UiKey } from "./ui-en";
import { hi } from "./ui-hi";
import { others } from "./ui-in";

export const LANGS = [
  { code: "en", name: "English", font: "" },
  { code: "hi", name: "हिन्दी", font: "Noto+Sans+Devanagari" },
  { code: "gu", name: "ગુજરાતી", font: "Noto+Sans+Gujarati" },
  { code: "mr", name: "मराठी", font: "Noto+Sans+Devanagari" },
  { code: "bn", name: "বাংলা", font: "Noto+Sans+Bengali" },
  { code: "ta", name: "தமிழ்", font: "Noto+Sans+Tamil" },
  { code: "te", name: "తెలుగు", font: "Noto+Sans+Telugu" },
  { code: "kn", name: "ಕನ್ನಡ", font: "Noto+Sans+Kannada" },
  { code: "ml", name: "മലയാളം", font: "Noto+Sans+Malayalam" },
  { code: "pa", name: "ਪੰਜਾਬੀ", font: "Noto+Sans+Gurmukhi" },
  { code: "ur", name: "اردو", font: "Noto+Naskh+Arabic" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];
export const DEFAULT_LANG: Lang = "en";
export const isLang = (x: unknown): x is Lang => typeof x === "string" && LANGS.some((l) => l.code === x);
export const isRtl = (l: Lang) => l === "ur";

const dicts: Record<string, Partial<Record<UiKey, string>>> = { en, hi, ...others };

/** Look up a UI string; missing keys fall back to English, never to an empty string. */
export function tr(lang: Lang, key: UiKey, vars: Record<string, string | number> = {}): string {
  const s = dicts[lang]?.[key] ?? en[key];
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export type Tr = (key: UiKey, vars?: Record<string, string | number>) => string;
export const trFor = (lang: Lang): Tr => (key, vars) => tr(lang, key, vars);

export type { UiKey };
