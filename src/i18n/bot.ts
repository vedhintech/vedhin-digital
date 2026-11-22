// Seller chatbot copy + language detection. The bot replies in the language the seller writes in.
// Hand-written catalogs: English, Hindi (Devanagari), Hinglish (Roman Hindi). Any other Indian language is
// answered by translating the English reply with the AI provider (budget-limited), falling back to English.
import { PRICING } from "./hinglish";
import type { Lang } from "./index";

export type BotLang = Lang | "hinglish";
export const BOT_DEFAULT: BotLang = "en";

export interface BotCatalog {
  unknownNumber: string;
  menu: (name: string) => string;
  design: string;
  designDone: (link: string) => string;
  designBad: string;
  askPhoto: string;
  gotDraft: (name: string, desc: string) => string;
  askStock: string;
  askPrice: string;
  productAdded: (name: string, link: string) => string;
  needPhoto: string;
  noMedia: string;
  voiceNo: string;
  priceSet: (name: string, price: number) => string;
  stockSet: (name: string, n: number) => string;
  soldOut: (name: string) => string;
  pickProduct: (names: string[]) => string;
  noProduct: string;
  ordersSummary: (pay: number, pack: number, link: string) => string;
  ordersPreview: string;
  shopLink: (link: string) => string;
  plan: string;
  callNoted: string;
  help: (link: string) => string;
  stopped: string;
  limitHit: string;
  aiLimit: string;
  changeNoted: string;
  changePaid: string;
  unknown: string;
  portalLink: (link: string) => string;
  noSellerYet: string;
  priceHelp: string;
}

const list = (names: string[]) => names.map((n) => "• " + n).join("\n");

export const botEn: BotCatalog = {
  unknownNumber: "Hello! This is the Vedhin Technology number. To talk about your shop, please call us.",
  menu: (name) => `Hello ${name}! What would you like to do? Reply with a number:\n1. Change design (colour, logo, headline)\n2. Add a product (send a photo)\n3. Change price or stock\n4. See orders\n5. My shop link\n6. Plan and pricing\n7. I need a call\n8. Help`,
  design: "To change the design, write like this:\n• colour pink (or indigo, maroon, emerald, black)\n• logo Rang Collection\n• headline New suits are here\n• banner 10% off for Diwali",
  designDone: (link) => `Done! See your shop: ${link}`,
  designBad: "I did not understand that. Write 'design' to see examples.",
  askPhoto: "Send one clear photo of the product.",
  gotDraft: (name, desc) => `Got the photo. Name: ${name}\n${desc}\nNow tell me the price (for example 799).`,
  askStock: "How many pieces do you have? (write a number)",
  askPrice: "Write the price as a number, for example 799.",
  productAdded: (name, link) => `${name} is added! See it here: ${link}`,
  needPhoto: "Please send a photo, or write 'menu'.",
  noMedia: "The photo could not be downloaded. Please send it again.",
  voiceNo: "I cannot understand voice notes yet. Please type your message.",
  priceSet: (name, price) => `${name} price set to ₹${price}.`,
  stockSet: (name, n) => `${name} stock set to ${n}.`,
  soldOut: (name) => `${name} marked as sold out.`,
  pickProduct: (names) => `Which product? Write the full name:\n${list(names)}`,
  noProduct: "I could not find that product. Please write the name again.",
  ordersSummary: (pay, pack, link) => `Payments to check: ${pay}\nOrders to pack: ${pack}\nOpen the portal to see orders and dispatch: ${link}`,
  ordersPreview: "Your shop is still in preview, so there are no orders yet. They will appear here once it goes live.",
  shopLink: (link) => `Your shop link: ${link}\nAdd it to your WhatsApp status and Instagram bio.`,
  plan: `Vedhin plan:\n• Setup ₹${PRICING.setup} (one time): your shop, seller portal, 20 products, order tracking, 2 free changes.\n• Optional support ₹${PRICING.support}/month (first month free): bug support, bot, 2 changes a month.\n• Extra change ₹${PRICING.extraChange}.\nWrite '7' if you want to buy, and the founder will call you.`,
  callNoted: "Okay, the founder will call you soon.",
  help: (link) => `If you have a problem, write it here. Portal: ${link}\nWrite 'menu' to see the menu.`,
  stopped: "Okay, we will not message you any more. Write 'menu' if you change your mind.",
  limitHit: "The bot limit for today is used up. Call us to talk to the founder, or write again tomorrow.",
  aiLimit: "Today's photo/AI limit is used up. Try again tomorrow, or add the product from the portal.",
  changeNoted: "Your request is noted. The founder will review it and reply.",
  changePaid: `This is an extra change (₹${PRICING.extraChange}). Write 'yes' to go ahead and the founder will confirm.`,
  unknown: "I did not understand. Write 'menu' for the menu, or '7' for a call.",
  portalLink: (link) => `Your seller portal (works once, valid 7 days): ${link}`,
  noSellerYet: "The seller portal is available after payment. For now you can change the website design and products here.",
  priceHelp: "To change a price write: bangle set 499\nStock: stock bangle set 10\nSold out: bangle set sold out",
};

export const botHinglish: BotCatalog = {
  unknownNumber: "Namaste! Ye Vedhin Technology ka number hai. Aapki dukaan ke baare me baat karne ke liye hamse call par sampark karein.",
  menu: (name) => `Namaste ${name} ji! Kya karna hai? Number likhein:\n1. Design badlo (rang, logo, headline)\n2. Naya product jodo (photo bhejein)\n3. Price ya stock badlo\n4. Orders dekho\n5. Meri dukaan ka link\n6. Plan aur rate\n7. Mujhe call chahiye\n8. Help`,
  design: "Design badalne ke liye aise likhein:\n• rang gulabi (ya indigo, maroon, emerald, black)\n• logo Rang Collection\n• headline Naye suits aa gaye\n• banner Diwali par 10% off",
  designDone: (link) => `Ho gaya! Dukaan dekhein: ${link}`,
  designBad: "Ye samajh nahi aaya. 'design' likhkar example dekhein.",
  askPhoto: "Product ki saaf photo bhejein (ek baar me ek).",
  gotDraft: (name, desc) => `Photo mil gayi. Naam: ${name}\n${desc}\nAb iska price batayein (jaise 799).`,
  askStock: "Kitne piece hain? (number likhein)",
  askPrice: "Price number me likhein, jaise 799.",
  productAdded: (name, link) => `${name} jud gaya! Dekhein: ${link}`,
  needPhoto: "Photo bhejein, ya 'menu' likhein.",
  noMedia: "Photo download nahi ho payi. Dobara bhejein.",
  voiceNo: "Voice note abhi samajh nahi paate. Kripya likhkar bhejein.",
  priceSet: (name, price) => `${name} ka price ₹${price} kar diya.`,
  stockSet: (name, n) => `${name} ka stock ${n} kar diya.`,
  soldOut: (name) => `${name} sold out kar diya.`,
  pickProduct: (names) => `Kaunsa product? Poora naam likhein:\n${list(names)}`,
  noProduct: "Ye product nahi mila. Naam dubara likhein.",
  ordersSummary: (pay, pack, link) => `Payment check karne wale: ${pay}\nPack karne wale: ${pack}\nOrders dekhne aur dispatch ke liye portal kholein: ${link}`,
  ordersPreview: "Abhi aapki dukaan preview me hai, to orders nahi aate. Live hone ke baad yahan dikhenge.",
  shopLink: (link) => `Aapki dukaan ka link: ${link}\nIse WhatsApp status aur Instagram bio me lagayein.`,
  plan: `Vedhin ka plan:\n• Setup ₹${PRICING.setup} (ek baar): aapki dukaan, seller portal, 20 products, order tracking, 2 free changes.\n• Optional support ₹${PRICING.support}/mahina (pehla mahina free): bug support, bot, 2 changes/mahina.\n• Extra change ₹${PRICING.extraChange}.\nLene ke liye '7' likhein, founder aapko call karenge.`,
  callNoted: "Theek hai, founder aapko jald call karenge.",
  help: (link) => `Koi dikkat ho to yahin likhein. Portal: ${link}\nMenu ke liye 'menu' likhein.`,
  stopped: "Theek hai, ab hum aapko message nahi bhejenge. Dobara chahein to 'menu' likhein.",
  limitHit: "Aaj ke liye bot ki limit poori ho gayi. Founder se baat karni ho to hamein call karein, ya kal dobara likhein.",
  aiLimit: "Aaj ki photo/AI limit poori ho gayi. Kal dobara try karein, ya portal se product jodein.",
  changeNoted: "Aapki request note kar li. Founder dekh kar batayenge.",
  changePaid: `Ye extra change hai (₹${PRICING.extraChange}). Theek ho to 'haan' likhein, founder confirm karenge.`,
  unknown: "Samajh nahi aaya. Menu ke liye 'menu' likhein, ya call ke liye '7'.",
  portalLink: (link) => `Aapka seller portal (ek baar chalega, 7 din): ${link}`,
  noSellerYet: "Seller portal paid hone ke baad milega. Abhi website ka design aur products yahin badal sakte hain.",
  priceHelp: "Price badalne ke liye likhein: kangan set 499\nStock: stock kangan set 10\nSold out: kangan set khatam",
};

export const botHi: BotCatalog = {
  unknownNumber: "नमस्ते! यह Vedhin Technology का नंबर है। अपनी दुकान के बारे में बात करने के लिए हमें कॉल करें।",
  menu: (name) => `नमस्ते ${name} जी! क्या करना है? नंबर लिखें:\n1. डिज़ाइन बदलें (रंग, लोगो, हेडलाइन)\n2. नया प्रोडक्ट जोड़ें (फ़ोटो भेजें)\n3. प्राइस या स्टॉक बदलें\n4. ऑर्डर देखें\n5. मेरी दुकान का लिंक\n6. प्लान और रेट\n7. मुझे कॉल चाहिए\n8. मदद`,
  design: "डिज़ाइन बदलने के लिए ऐसे लिखें:\n• रंग गुलाबी (या नीला, लाल, हरा, काला)\n• logo Rang Collection\n• headline नए सूट आ गए\n• banner दिवाली पर 10% छूट",
  designDone: (link) => `हो गया! अपनी दुकान देखें: ${link}`,
  designBad: "यह समझ नहीं आया। उदाहरण देखने के लिए 'design' लिखें।",
  askPhoto: "प्रोडक्ट की साफ़ फ़ोटो भेजें (एक बार में एक)।",
  gotDraft: (name, desc) => `फ़ोटो मिल गई। नाम: ${name}\n${desc}\nअब इसका प्राइस बताएं (जैसे 799)।`,
  askStock: "कितने पीस हैं? (नंबर लिखें)",
  askPrice: "प्राइस नंबर में लिखें, जैसे 799।",
  productAdded: (name, link) => `${name} जुड़ गया! यहाँ देखें: ${link}`,
  needPhoto: "फ़ोटो भेजें, या 'menu' लिखें।",
  noMedia: "फ़ोटो डाउनलोड नहीं हो पाई। दोबारा भेजें।",
  voiceNo: "वॉइस नोट अभी समझ नहीं पाते। कृपया लिखकर भेजें।",
  priceSet: (name, price) => `${name} का प्राइस ₹${price} कर दिया।`,
  stockSet: (name, n) => `${name} का स्टॉक ${n} कर दिया।`,
  soldOut: (name) => `${name} सोल्ड आउट कर दिया।`,
  pickProduct: (names) => `कौन सा प्रोडक्ट? पूरा नाम लिखें:\n${list(names)}`,
  noProduct: "यह प्रोडक्ट नहीं मिला। नाम दोबारा लिखें।",
  ordersSummary: (pay, pack, link) => `पेमेंट चेक करने वाले: ${pay}\nपैक करने वाले: ${pack}\nऑर्डर देखने और डिस्पैच के लिए पोर्टल खोलें: ${link}`,
  ordersPreview: "अभी आपकी दुकान प्रीव्यू में है, इसलिए ऑर्डर नहीं आते। लाइव होने के बाद यहाँ दिखेंगे।",
  shopLink: (link) => `आपकी दुकान का लिंक: ${link}\nइसे WhatsApp स्टेटस और Instagram बायो में लगाएं।`,
  plan: `Vedhin का प्लान:\n• सेटअप ₹${PRICING.setup} (एक बार): आपकी दुकान, सेलर पोर्टल, 20 प्रोडक्ट, ऑर्डर ट्रैकिंग, 2 फ्री बदलाव।\n• वैकल्पिक सपोर्ट ₹${PRICING.support}/महीना (पहला महीना फ्री): बग सपोर्ट, बॉट, महीने में 2 बदलाव।\n• एक्स्ट्रा बदलाव ₹${PRICING.extraChange}।\nलेने के लिए '7' लिखें, फाउंडर आपको कॉल करेंगे।`,
  callNoted: "ठीक है, फाउंडर आपको जल्द कॉल करेंगे।",
  help: (link) => `कोई दिक्कत हो तो यहीं लिखें। पोर्टल: ${link}\nमेन्यू के लिए 'menu' लिखें।`,
  stopped: "ठीक है, अब हम आपको मैसेज नहीं भेजेंगे। दोबारा चाहें तो 'menu' लिखें।",
  limitHit: "आज के लिए बॉट की लिमिट पूरी हो गई। फाउंडर से बात करनी हो तो हमें कॉल करें, या कल दोबारा लिखें।",
  aiLimit: "आज की फ़ोटो/AI लिमिट पूरी हो गई। कल दोबारा कोशिश करें, या पोर्टल से प्रोडक्ट जोड़ें।",
  changeNoted: "आपकी रिक्वेस्ट नोट कर ली। फाउंडर देखकर बताएंगे।",
  changePaid: `यह एक्स्ट्रा बदलाव है (₹${PRICING.extraChange})। ठीक हो तो 'हाँ' लिखें, फाउंडर कन्फर्म करेंगे।`,
  unknown: "समझ नहीं आया। मेन्यू के लिए 'menu' लिखें, या कॉल के लिए '7'।",
  portalLink: (link) => `आपका सेलर पोर्टल (एक बार चलेगा, 7 दिन): ${link}`,
  noSellerYet: "सेलर पोर्टल पेमेंट के बाद मिलेगा। अभी वेबसाइट का डिज़ाइन और प्रोडक्ट यहीं बदल सकते हैं।",
  priceHelp: "प्राइस बदलने के लिए लिखें: kangan set 499\nस्टॉक: stock kangan set 10\nसोल्ड आउट: kangan set खत्म",
};

/** Catalog for a language; other Indian languages use English then get AI-translated (see translateReplies). */
export const catalogFor = (l: BotLang): BotCatalog => (l === "hi" ? botHi : l === "hinglish" ? botHinglish : botEn);
export const hasCatalog = (l: BotLang) => l === "en" || l === "hi" || l === "hinglish";

export const LANG_NAMES: Record<BotLang, string> = {
  en: "English", hinglish: "Hinglish (Hindi written in Roman letters)", hi: "Hindi (Devanagari)", gu: "Gujarati", mr: "Marathi", bn: "Bengali",
  ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", pa: "Punjabi (Gurmukhi)", ur: "Urdu",
};

const HINGLISH_WORDS = new Set(["hai", "hain", "hoga", "hogi", "kya", "kaise", "kaisa", "kar", "karo", "karna", "karein", "kijiye", "kijie", "karke", "mujhe", "mera", "meri", "mere", "hamara", "nahi", "nhi", "haan", "ha", "aap", "aapka", "apna", "apni", "bhai", "didi", "dikhao", "dikha", "badlo", "badal", "badalna", "chahiye", "bhejo", "bhej", "dukaan", "dukan", "rang", "naya", "nayi", "jodo", "jod", "batao", "bataiye", "abhi", "kitna", "kitne", "kal", "aaj", "wala", "wali", "khatam", "bada", "chhota", "laga", "lagao", "hatao", "bekar", "dikkat", "paisa", "paise", "kab", "kahan", "kaun", "kuch", "sab", "theek", "accha", "acha", "namaste", "namaskar", "gulabi", "neela", "laal", "hara", "kala", "safed", "ko", "ka", "ki", "ke", "se", "me", "mein", "par", "pe", "aur", "ya", "tak"]);
// Words that are valid English too, so one of them alone must not flip the language.
const WEAK = new Set(["ha", "ko", "ka", "ki", "ke", "se", "me", "par", "pe", "ya", "tak", "sab", "kal", "ya", "rang", "naya"]);

const SCRIPTS: [RegExp, Lang][] = [
  [/[઀-૿]/, "gu"], [/[ঀ-৿]/, "bn"], [/[஀-௿]/, "ta"], [/[ఀ-౿]/, "te"],
  [/[ಀ-೿]/, "kn"], [/[ഀ-ൿ]/, "ml"], [/[਀-੿]/, "pa"], [/[؀-ۿ]/, "ur"],
];
const MARATHI_HINTS = /(आहे|आहेत|नको|काय|करा|माझ|तुम्ही|मला|हवे|आणि)/;

/**
 * Which language is this message written in? Returns null when it is too short/ambiguous (digits, "menu", a
 * single product name), so the caller keeps the seller's previous language.
 */
export function detectLang(text: string): BotLang | null {
  const t = text.trim();
  if (!t) return null;
  for (const [re, l] of SCRIPTS) if (re.test(t)) return l;
  if (/[ऀ-ॿ]/.test(t)) return MARATHI_HINTS.test(t) ? "mr" : "hi";
  const words = t.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const strong = words.filter((w) => HINGLISH_WORDS.has(w) && !WEAK.has(w)).length;
  const weak = words.filter((w) => WEAK.has(w)).length;
  if (strong >= 1 || weak >= 2) return "hinglish";
  // Clear English: at least 3 plain words with no Hindi markers.
  if (words.length >= 3) return "en";
  return null;
}

const DEV_MAP: [RegExp, string][] = [
  [/नमस्ते|नमस्कार/g, "namaste"], [/मेन्यू|मेनू|मेन्यु/g, "menu"], [/रंग/g, "rang"], [/गुलाबी/g, "gulabi"], [/नीला/g, "neela"], [/लाल/g, "laal"],
  [/हरा/g, "hara"], [/काला/g, "kala"], [/सफेद|सफ़ेद/g, "safed"], [/बदलो|बदलें|बदल/g, "badlo"], [/खत्म|ख़त्म/g, "khatam"], [/स्टॉक/g, "stock"],
  [/लोगो/g, "logo"], [/बैनर/g, "banner"], [/हेडलाइन/g, "headline"], [/हाँ|हां/g, "haan"], [/रुको|बंद करो|बंद कर दो|मत भेजो|नहीं चाहिए/g, "stop"],
  [/सोल्ड आउट/g, "sold out"], [/डिज़ाइन|डिजाइन/g, "design"], [/मदद/g, "help"],
];
/** Lets the rule-based commands understand Devanagari Hindi: ASCII digits + common keywords mapped to the Roman commands. */
export function devanagariToRules(text: string): string {
  let t = text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
  for (const [re, to] of DEV_MAP) t = t.replace(re, to);
  return t;
}
