// RFC 6238 TOTP (Google Authenticator / Authy compatible) using WebCrypto only.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const ch of clean) {
    val = (val << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
export function newTotpSecret(): string {
  const b = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0, val = 0, out = "";
  for (const x of b) {
    val = (val << 8) | x; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return out;
}
async function hotp(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setUint32(0, Math.floor(counter / 2 ** 32));
  dv.setUint32(4, counter >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const o = h[19]! & 15;
  const code = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(code % 1_000_000).padStart(6, "0");
}
/** Accepts the current 30s code plus one step either side (clock drift). */
export async function verifyTotp(secret: string, code: string, nowMs = Date.now()): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const step = Math.floor(nowMs / 30_000);
  for (const d of [-1, 0, 1]) if ((await hotp(secret, step + d)) === code) return true;
  return false;
}
export const totpCode = (secret: string, nowMs = Date.now()) => hotp(secret, Math.floor(nowMs / 30_000));
export const totpUri = (secret: string, account = "founder") => `otpauth://totp/Vedhin%20Admin:${encodeURIComponent(account)}?secret=${secret}&issuer=Vedhin%20Admin`;
