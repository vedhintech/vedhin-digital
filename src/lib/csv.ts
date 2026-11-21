/** Minimal CSV parser (quotes, commas, CRLF). Returns rows as objects keyed by lower-cased header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (ch === '"') q = false;
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { cur.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(f); f = "";
      if (cur.some((x) => x.trim() !== "")) rows.push(cur);
      cur = [];
    } else f += ch;
  }
  cur.push(f);
  if (cur.some((x) => x.trim() !== "")) rows.push(cur);
  if (rows.length < 2) return [];
  const head = rows[0]!.map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}
