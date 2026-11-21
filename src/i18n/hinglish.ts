// All user-facing strings live here (never hardcode in routes). Simple Hinglish, respectful tone.
export const t = {
  shopNotFound: "Ye dukaan nahi mili. Link dobara check karein.",
  previewExpired: "Ye preview band ho gayi hai. Vedhin Technology se baat karein.",
  shopSuspended: "Ye dukaan abhi band hai.",
  productNotFound: "Ye product nahi mila.",
  somethingWrong: "Kuch gadbad ho gayi, thodi der baad dobara try karein.",
  invalidInput: "Details sahi nahi hain, dobara check karein.",
} as const;

export const PRICING = { setup: 1999, support: 499, extraChange: 99 } as const;

export const bot = {
  unknownNumber: "Namaste! Ye Vedhin Technology ka number hai. Aapki dukaan ke baare me baat karne ke liye hamse call par sampark karein.",
  menu: (name: string) =>
    `Namaste ${name} ji! Kya karna hai? Number likhein:\n1. Design badlo (rang, logo, headline)\n2. Naya product jodo (photo bhejein)\n3. Price ya stock badlo\n4. Orders dekho\n5. Meri dukaan ka link\n6. Plan aur rate\n7. Mujhe call chahiye\n8. Help`,
  design: "Design badalne ke liye aise likhein:\n• rang gulabi (ya indigo, maroon, emerald, black)\n• logo Rang Collection\n• headline Naye suits aa gaye\n• banner Diwali par 10% off",
  designDone: (link: string) => `Ho gaya! Dukaan dekhein: ${link}`,
  designBad: "Ye samajh nahi aaya. 'design' likhkar example dekhein.",
  askPhoto: "Product ki saaf photo bhejein (ek baar me ek).",
  gotDraft: (name: string, desc: string) => `Photo mil gayi. Naam: ${name}\n${desc}\nAb iska price batayein (jaise 799).`,
  askStock: "Kitne piece hain? (number likhein)",
  askPrice: "Price number me likhein, jaise 799.",
  productAdded: (name: string, link: string) => `${name} jud gaya! Dekhein: ${link}`,
  needPhoto: "Photo bhejein, ya 'menu' likhein.",
  noMedia: "Photo download nahi ho payi. Dobara bhejein.",
  voiceNo: "Voice note abhi samajh nahi paate. Kripya likhkar bhejein.",
  priceSet: (name: string, price: number) => `${name} ka price ₹${price} kar diya.`,
  stockSet: (name: string, n: number) => `${name} ka stock ${n} kar diya.`,
  soldOut: (name: string) => `${name} sold out kar diya.`,
  pickProduct: (names: string[]) => `Kaunsa product? Poora naam likhein:\n${names.map((n) => "• " + n).join("\n")}`,
  noProduct: "Ye product nahi mila. Naam dubara likhein.",
  ordersSummary: (pay: number, pack: number, link: string) => `Payment check karne wale: ${pay}\nPack karne wale: ${pack}\nOrders dekhne aur dispatch ke liye portal kholein: ${link}`,
  ordersPreview: "Abhi aapki dukaan preview me hai, to orders nahi aate. Live hone ke baad yahan dikhenge.",
  shopLink: (link: string) => `Aapki dukaan ka link: ${link}\nIse WhatsApp status aur Instagram bio me lagayein.`,
  plan: `Vedhin ka plan:\n• Setup ₹${PRICING.setup} (ek baar): aapki dukaan, seller portal, 20 products, order tracking, 2 free changes.\n• Optional support ₹${PRICING.support}/mahina (pehla mahina free): bug support, bot, 2 changes/mahina.\n• Extra change ₹${PRICING.extraChange}.\nLene ke liye '7' likhein, founder aapko call karenge.`,
  callNoted: "Theek hai, founder aapko jald call karenge.",
  help: (link: string) => `Koi dikkat ho to yahin likhein. Portal: ${link}\nMenu ke liye 'menu' likhein.`,
  stopped: "Theek hai, ab hum aapko message nahi bhejenge. Dobara chahein to 'menu' likhein.",
  limitHit: "Aaj ke liye bot ki limit poori ho gayi. Founder se baat karni ho to hamein call karein, ya kal dobara likhein.",
  aiLimit: "Aaj ki photo/AI limit poori ho gayi. Kal dobara try karein, ya portal se product jodein.",
  changeNoted: "Aapki request note kar li. Founder dekh kar batayenge.",
  changePaid: `Ye extra change hai (₹${PRICING.extraChange}). Theek ho to 'haan' likhein, founder confirm karenge.`,
  unknown: "Samajh nahi aaya. Menu ke liye 'menu' likhein, ya call ke liye '7'.",
  portalLink: (link: string) => `Aapka seller portal (ek baar chalega, 7 din): ${link}`,
  noSellerYet: "Seller portal paid hone ke baad milega. Abhi website ka design aur products yahin badal sakte hain.",
} as const;
