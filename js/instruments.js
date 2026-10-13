// Instrument specs and currency conversion. Pure module (no DOM) so it can be tested with Node.

const MAJORS = ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDJPY", "USDCHF", "USDCAD"];
const CROSSES = ["EURGBP", "EURJPY", "EURCHF", "EURAUD", "EURCAD", "EURNZD", "GBPJPY", "GBPCHF", "GBPAUD", "GBPCAD", "GBPNZD",
  "AUDJPY", "AUDNZD", "AUDCAD", "AUDCHF", "NZDJPY", "NZDCAD", "NZDCHF", "CADJPY", "CADCHF", "CHFJPY"];

function fx(s) {
  const quote = s.slice(3);
  const jpy = quote === "JPY";
  return { s, base: s.slice(0, 3), quote, contract: 100000, pip: jpy ? 0.01 : 0.0001, digits: jpy ? 3 : 5, pipName: "pip" };
}

export const GROUPS = [
  ["Metal", [
    { s: "XAUUSD", base: "XAU", quote: "USD", contract: 100, pip: 0.1, digits: 2, pipName: "pip ($0.10)" },
    { s: "XAGUSD", base: "XAG", quote: "USD", contract: 5000, pip: 0.01, digits: 3, pipName: "pip ($0.01)" },
  ]],
  ["Major", MAJORS.map(fx)],
  ["Cross", CROSSES.map(fx)],
];

export const PAIRS = {};
GROUPS.forEach(([, list]) => list.forEach(p => (PAIRS[p.s] = p)));

// How each quote currency is usually quoted against USD (for the label shown to the user).
// inv = true means the market quotes USDxxx, so 1 xxx = 1 / rate USD.
export const CONV = {
  EUR: { pair: "EURUSD", inv: false, fallback: 1.16 },
  GBP: { pair: "GBPUSD", inv: false, fallback: 1.34 },
  AUD: { pair: "AUDUSD", inv: false, fallback: 0.66 },
  NZD: { pair: "NZDUSD", inv: false, fallback: 0.58 },
  JPY: { pair: "USDJPY", inv: true, fallback: 150 },
  CHF: { pair: "USDCHF", inv: true, fallback: 0.80 },
  CAD: { pair: "USDCAD", inv: true, fallback: 1.39 },
};

export function needsConversion(p) {
  return p.quote !== "USD" && p.base !== "USD";
}

/** Market-style rate for the conversion pair (e.g. GBPUSD 1.32 or USDJPY 158.6) from an "USD per 1 unit" map. */
export function marketRate(quote, usdPer) {
  const c = CONV[quote];
  if (!c) return 1; // USD itself
  const u = usdPer && usdPer[quote];
  if (!(u > 0)) return c.fallback;
  return c.inv ? 1 / u : u;
}

/**
 * USD value of 1 unit of the pair's quote currency.
 * price: the pair's own price (used when USD is the base, e.g. USDJPY).
 * rate: market-style rate of the conversion pair (e.g. GBPUSD), used for crosses.
 */
export function quoteToUSD(p, price, rate) {
  if (p.quote === "USD") return 1;
  if (p.base === "USD") return price > 0 ? 1 / price : NaN;
  const c = CONV[p.quote];
  if (!(rate > 0)) return NaN;
  return c.inv ? 1 / rate : rate;
}
