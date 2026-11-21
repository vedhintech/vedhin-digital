export interface Env {
  DB: D1Database;
  MEDIA?: R2Bucket;
  APP_ENV: string;
  AI_PROVIDER: string;
  SESSION_SECRET?: string;
  ADMIN_PASSWORD?: string;
  GEMINI_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_TEMPLATE_OPENING?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  category: string | null;
  status: "preview" | "live" | "suspended" | "expired";
  expires_at: string | null;
  plan: string | null;
  template_id: string | null;
  theme_json: string | null;
  logo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  maps_url: string | null;
  address: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  upi_id: string | null;
  upi_qr_url: string | null;
}

export type AppVars = { shop: Shop; sellerId: string };
export type AppBindings = { Bindings: Env; Variables: AppVars };
