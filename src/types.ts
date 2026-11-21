export interface Env {
  DB: D1Database;
  APP_ENV: string;
  AI_PROVIDER: string;
  GEMINI_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  category: string | null;
  status: "preview" | "live" | "suspended" | "expired";
  expires_at: string | null;
  theme_json: string | null;
  logo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  maps_url: string | null;
  address: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  upi_id: string | null;
}

export type AppVars = { shop: Shop };
export type AppBindings = { Bindings: Env; Variables: AppVars };
