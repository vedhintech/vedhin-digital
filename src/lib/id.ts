const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newId(): string {
  const time = Date.now();
  let ts = "";
  let n = time;
  for (let i = 0; i < 10; i++) {
    ts = ALPHABET[n % 32] + ts;
    n = Math.floor(n / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let rand = "";
  for (const b of bytes) rand += ALPHABET[b % 32];
  return ts + rand;
}
