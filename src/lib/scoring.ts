// Hot-lead scoring (docs/07). Pure function over signals so it is easy to test.
export interface Signals {
  views: number;
  inboundMessages: number;
  uploadedAssets: boolean;
  demoPortalViews: number;
  askedPrice: boolean;
  callRequested: boolean;
  activeDays: number;
  daysSinceActivity: number | null; // null = never active
  optedOut: boolean;
}

export const HOT_THRESHOLD = 7;

export function computeScore(s: Signals): number {
  let n = 0;
  if (s.views >= 3) n += 2;
  if (s.inboundMessages >= 7) n += 3;
  if (s.uploadedAssets) n += 3;
  if (s.demoPortalViews >= 1) n += 2;
  if (s.askedPrice) n += 4;
  if (s.callRequested) n += 3;
  if (s.activeDays >= 2) n += 1;
  if (s.daysSinceActivity !== null && s.daysSinceActivity >= 5) n -= 3;
  if (s.optedOut) n -= 5;
  return n;
}

export const PRICE_RE = /(price|rate|kitna|kitne|kharid|buy|paisa|paise|cost|₹|rs\.?\s?\d|1999|499|payment)/i;
