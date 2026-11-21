// Tiny safe HTML templating. Interpolations are escaped unless wrapped in raw().
export class Raw {
  constructor(public value: string) {}
  toString() {
    return this.value;
  }
}
export const raw = (s: string) => new Raw(s);

export function esc(v: unknown): string {
  if (v instanceof Raw) return v.value;
  if (v === null || v === undefined || v === false) return "";
  if (Array.isArray(v)) return v.map(esc).join("");
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += esc(values[i]);
  });
  return new Raw(out);
}

export const rupees = (n: number | null | undefined) => "₹" + Number(n ?? 0).toLocaleString("en-IN");

/** Only allow http(s) URLs or our own /media paths in href/src from user data. */
export function safeUrl(u: string | null | undefined): string {
  if (!u) return "";
  const s = u.trim();
  if (/^https?:\/\//i.test(s) || s.startsWith("/media/") || s.startsWith("/ph/")) return s;
  return "";
}
