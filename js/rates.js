// Daily reference FX rates (ECB via Frankfurter, fallback exchangerate-api). Only used to convert
// P/L of cross pairs (e.g. GBPJPY, EURGBP) into USD, so a daily rate is precise enough for sizing.

import { state, update } from "./store.js";

const CURRENCIES = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];
const MAX_AGE = 3 * 60 * 60 * 1000; // refetch after 3 hours

const SOURCES = [
  {
    name: "ECB (Frankfurter)",
    url: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=" + CURRENCIES.join(","),
    parse: j => ({ date: j.date, perUsd: j.rates }),
  },
  {
    name: "ExchangeRate-API",
    url: "https://open.er-api.com/v6/latest/USD",
    parse: j => ({ date: (j.time_last_update_utc || "").slice(5, 16), perUsd: j.rates }),
  },
];

async function getJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Returns "fresh" | "cached" | "failed". Updates state.rates on success. */
export async function refreshRates(force = false) {
  const cur = state.rates;
  if (!force && cur && Date.now() - cur.fetchedAt < MAX_AGE) return "cached";
  for (const src of SOURCES) {
    try {
      const { date, perUsd } = src.parse(await getJSON(src.url));
      const usdPer = {};
      for (const c of CURRENCIES) {
        const r = Number(perUsd && perUsd[c]);
        if (!(r > 0)) throw new Error("rate " + c + " missing");
        usdPer[c] = 1 / r;
      }
      update(s => { s.rates = { date, source: src.name, fetchedAt: Date.now(), usdPer }; });
      return "fresh";
    } catch (e) {
      // try the next source
    }
  }
  return "failed";
}
