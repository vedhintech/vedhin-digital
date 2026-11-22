import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { AppBindings } from "../types";
import { DEFAULT_LANG, isLang, trFor, type Lang, type UiKey } from "../i18n";

/** Picks the buyer's language: ?lang= (remembered in a cookie) > cookie > English (the standard default). */
export const langMw: MiddlewareHandler<AppBindings> = async (c, next) => {
  const q = c.req.query("lang");
  const ck = getCookie(c, "vd_lang");
  let lang: Lang = DEFAULT_LANG;
  if (isLang(q)) {
    lang = q;
    setCookie(c, "vd_lang", q, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "Lax", secure: new URL(c.req.url).protocol === "https:" });
  } else if (isLang(ck)) lang = ck;
  c.set("lang", lang);
  await next();
};

/** Translate a UI key in the current request's language. */
export const tt = (c: Context<AppBindings>, key: UiKey, vars?: Record<string, string | number>) => trFor(c.var.lang ?? DEFAULT_LANG)(key, vars);
