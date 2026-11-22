// Legacy generic API/system messages and shared pricing constants. Buyer UI text lives in i18n/ui-*.ts, bot copy in i18n/bot.ts.
export const t = {
  shopNotFound: "Ye dukaan nahi mili. Link dobara check karein.",
  previewExpired: "Ye preview band ho gayi hai. Vedhin Technology se baat karein.",
  shopSuspended: "Ye dukaan abhi band hai.",
  productNotFound: "Ye product nahi mila.",
  somethingWrong: "Kuch gadbad ho gayi, thodi der baad dobara try karein.",
  invalidInput: "Details sahi nahi hain, dobara check karein.",
} as const;

export const PRICING = { setup: 1999, support: 499, extraChange: 99 } as const;
